import Image from "next/image";
import Link from "next/link";
import Reveal from "../components/Reveal";
import PillarGrid from "../components/PillarGrid";

const APP_STORE_URL = "#";

function DownloadButton({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <a
      href={APP_STORE_URL}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full bg-white text-[#0c0c0c] font-semibold tracking-[-0.01em] border-2 border-[#6FA8FF] transition-opacity hover:opacity-80 active:opacity-60 ${
        size === "lg" ? "px-10 py-3.5 text-[15px] min-w-[220px]" : "px-8 py-3 text-[14px] min-w-[200px]"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#0c0c0c" className="shrink-0">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      Download Free
    </a>
  );
}

// iPhone 16 Pro proportions — used only for hero
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
              "0 20px 55px rgba(0,0,0,0.55)",
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

// ── Feature illustrations ─────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(111,168,255,0.18)",
  borderRadius: 20,
  padding: "22px 20px",
  fontFamily: "inherit",
};

function IllustrationLog() {
  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 14 }}>WHAT DID YOU EAT?</p>
      <div style={{
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12, padding: "12px 14px", fontSize: 14,
        color: "rgba(255,255,255,0.85)", lineHeight: 1.5, marginBottom: 14,
      }}>
        Grilled salmon, roasted broccoli, brown rice
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
          </svg>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
        <div style={{ background: "#6FA8FF", borderRadius: 20, padding: "7px 18px", fontSize: 13, color: "#0c0c0c", fontWeight: 600 }}>
          Log it
        </div>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 16 }} />
      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginBottom: 12 }}>AI ESTIMATE</p>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {([["520", "kcal"], ["38g", "protein"], ["52g", "carbs"], ["14g", "fat"]] as [string, string][]).map(([val, label], i) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: i === 1 ? "#6FA8FF" : "rgba(255,255,255,0.9)", lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IllustrationSummary() {
  const macros = [
    { label: "Protein", value: 142, max: 155, color: "#6FA8FF", display: "142g" },
    { label: "Carbs", value: 185, max: 250, color: "rgba(255,255,255,0.55)", display: "185g" },
    { label: "Fat", value: 58, max: 80, color: "rgba(255,255,255,0.35)", display: "58g" },
  ];
  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 16 }}>TODAY</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 22 }}>
        <span style={{ fontSize: 38, fontWeight: 700, color: "white", lineHeight: 1 }}>1,840</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>/ 2,400 kcal</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {macros.map(m => (
          <div key={m.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{m.label}</span>
              <span style={{ fontSize: 12, color: m.color, fontWeight: 600 }}>{m.display}</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
              <div style={{ width: `${(m.value / m.max) * 100}%`, height: "100%", background: m.color, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IllustrationPatterns() {
  const values = [65, 78, 55, 82, 91, 70, 85];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const maxV = Math.max(...values);
  const W = 240, H = 60;
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * W, y: H - (v / maxV) * H }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 16 }}>THIS WEEK</p>
      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", overflow: "visible", marginBottom: 16 }}>
        <defs>
          <linearGradient id="fillGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6FA8FF" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#6FA8FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#fillGrad)" />
        <path d={d} fill="none" stroke="rgba(111,168,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={values[i] >= 80 ? 5 : 3} fill={values[i] >= 80 ? "#6FA8FF" : "rgba(111,168,255,0.5)"} />
        ))}
        {days.map((day, i) => (
          <text key={i} x={pts[i].x} y={H + 16} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)" fontFamily="inherit">{day}</text>
        ))}
      </svg>
      <div style={{
        background: "rgba(111,168,255,0.08)", border: "1px solid rgba(111,168,255,0.2)",
        borderRadius: 12, padding: "10px 14px", fontSize: 13,
        color: "rgba(255,255,255,0.75)", lineHeight: 1.45,
      }}>
        <span style={{ color: "#6FA8FF", fontWeight: 600 }}>↑ </span>
        High-protein days match your best energy scores
      </div>
    </div>
  );
}

function IllustrationNutrients() {
  const items = [
    { name: "Vitamin D", pct: 89, hi: true },
    { name: "Iron", pct: 72, hi: true },
    { name: "Calcium", pct: 45, hi: false },
    { name: "Vitamin B12", pct: 94, hi: true },
    { name: "Magnesium", pct: 61, hi: true },
    { name: "Zinc", pct: 38, hi: false },
  ];
  return (
    <div style={cardStyle}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 16 }}>MICRONUTRIENTS</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {items.map(n => (
          <div key={n.name} style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${n.hi ? "rgba(111,168,255,0.2)" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 12, padding: "12px 10px",
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: n.hi ? "#6FA8FF" : "rgba(255,255,255,0.5)", lineHeight: 1, marginBottom: 4 }}>{n.pct}%</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.3 }}>{n.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const features = [
  {
    illustration: <IllustrationLog />,
    headline: "Just say what you ate.",
    body: "Type it, snap a photo, or describe it however feels natural. WhatYouAte handles the rest. No barcode scanner, no measuring cups, no database to dig through.",
  },
  {
    illustration: <IllustrationSummary />,
    headline: "See how your day actually looks.",
    body: "A clean breakdown of what you ate, updated every time you log. No complicated charts. Just an honest picture of your day.",
  },
  {
    illustration: <IllustrationPatterns />,
    headline: "Start noticing what works for you.",
    body: "Over time, WhatYouAte surfaces the patterns you never thought to look for. The meals that leave you feeling great and the habits quietly shaping how you feel.",
  },
  {
    illustration: <IllustrationNutrients />,
    headline: "More than just what you eat.",
    body: "See the vitamins and nutrients behind your meals, explained in plain language. Small signals that help you make slightly better choices every day.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white overflow-x-hidden" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>

      {/* ── NAV ──────────────────────────────────────────────── */}
      <header className="flex items-center px-8 py-6">
        <div className="flex items-center gap-2.5">
          <Image src="/icon.png" alt="WhatYouAte" width={26} height={26} className="rounded-[7px]" priority />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">WhatYouAt<span className="relative inline-block">e<span className="absolute -top-1 right-0 translate-x-[10px] text-[9px] font-semibold text-white/50" style={{ top: 0 }}>AI</span></span></span>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section
        className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-16 px-8 pt-16 md:min-h-[82vh]"
        style={{ paddingBottom: 60, background: "radial-gradient(ellipse 80% 60% at 65% 40%, rgba(111,168,255,0.13) 0%, #0c0c0c 65%)" }}
      >
        <div className="flex flex-col items-center md:items-start text-center md:text-left max-w-[440px]">
          <div className="hero-1 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2.5 text-[11px] font-medium text-white/50" style={{ marginBottom: 18 }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#6FA8FF]" />
            Free on the App Store
          </div>

          <h1 className="hero-2 text-[44px] sm:text-[56px] font-bold leading-[1.06] tracking-[-0.03em] mt-[10px] mb-8">
            Know what you ate<br />
            <span className="text-[#6FA8FF]">Feel the difference</span>
          </h1>

          <p className="hero-3 text-[18px] leading-[1.7] text-white/45 max-w-[360px]" style={{ marginBottom: 24 }}>
            Food affects how you feel every day. WhatYouAte helps you understand it without the obsessing.
          </p>

          <div className="hero-4 flex flex-col items-center md:items-start" style={{ gap: 14 }}>
            <DownloadButton size="lg" />
            <p className="text-[12px] text-white/40">7-day Pro trial included · iPhone only</p>
          </div>
        </div>

        <div className="hero-phone w-full max-w-[210px] md:max-w-[230px] flex-shrink-0">
          <PhoneFrame src="/screenshots/home.webp" alt="WhatYouAte home screen" tilt="rotateY(18deg) rotateX(5deg)" />
        </div>
      </section>

      {/* ── PILLARS ──────────────────────────────────────────── */}
      <section className="px-8 border-t border-white/[0.06]" style={{ paddingTop: 40, paddingBottom: 40, background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(111,168,255,0.05) 0%, transparent 70%)" }}>
        <div style={{ marginBottom: 60 }}>
          <Reveal className="mx-auto max-w-[560px] text-center">
            <h2 className="text-[30px] sm:text-[38px] font-bold text-white tracking-[-0.02em] leading-tight" style={{ marginBottom: 20 }}>
              Most nutrition apps feel like homework.
            </h2>
            <p className="text-[17px] text-white/45 leading-[1.7]">
              Barcode scanning, meal databases, daily logs, weekly reports. It is overwhelming. WhatYouAte is built for people who just want to eat a little better and actually feel it.
            </p>
          </Reveal>
        </div>
        <PillarGrid />
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section
        className="px-8 border-t border-white/[0.06]"
        style={{ paddingTop: 40, paddingBottom: 0, background: "radial-gradient(ellipse 70% 40% at 30% 20%, rgba(111,168,255,0.07) 0%, #0c0c0c 60%)" }}
      >
        {features.map((f, i) => {
          const isEven = i % 2 === 0;
          return (
            <div
              key={f.headline}
              className={`mx-auto max-w-5xl flex flex-col md:flex-row items-center ${i > 0 ? "border-t border-white/[0.06]" : ""} ${isEven ? "" : "md:flex-row-reverse"}`}
              style={{ gap: 40, paddingTop: i === 0 ? 0 : 40, paddingBottom: 80 }}
            >
              <Reveal className="w-full max-w-[300px] mx-auto md:mx-0 order-last md:order-none flex-shrink-0">
                {f.illustration}
              </Reveal>
              <Reveal delay={0.12} className="flex flex-col gap-5 text-center md:text-left max-w-[360px] mx-auto md:mx-0">
                <h3 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] leading-[1.2]">{f.headline}</h3>
                <p className="text-[16px] text-white/45 leading-[1.85]">{f.body}</p>
              </Reveal>
            </div>
          );
        })}
      </section>

      {/* ── APPLE HEALTH ─────────────────────────────────────── */}
      <section className="px-8 border-t border-white/[0.06]" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <Reveal className="mx-auto max-w-[480px] flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8" style={{ background: "rgba(255,59,92,0.12)", border: "1px solid rgba(255,59,92,0.25)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#FF3B5C">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <h2 className="text-[28px] sm:text-[34px] font-bold text-white tracking-[-0.02em] mb-4">
            Connects to Apple Health
          </h2>
          <p className="text-[16px] text-white/45 leading-relaxed max-w-[360px]">
            Your nutrition data lives right alongside your steps and sleep, exactly where it belongs.
          </p>
        </Reveal>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section
        className="px-8 text-center border-t border-white/[0.06]"
        style={{ paddingTop: 40, paddingBottom: 40, background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(111,168,255,0.09) 0%, #0c0c0c 65%)" }}
      >
        <Reveal className="mx-auto max-w-[440px]">
          <h2 className="text-[36px] sm:text-[46px] font-bold tracking-[-0.03em] leading-[1.1] mb-5">
            Give it a week.<br />See how you feel.
          </h2>
          <p className="text-[16px] text-white/40 leading-relaxed" style={{ marginBottom: 48 }}>
            Download free. 7-day Pro trial. No commitment.
          </p>
          <DownloadButton size="lg" />
        </Reveal>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-[#0c0c0c] border-t border-white/[0.07] px-8" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="mx-auto max-w-4xl flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="WhatYouAte" width={20} height={20} className="rounded-[5px]" />
            <span className="text-[13px] font-semibold tracking-[-0.01em]">WhatYouAt<span className="relative inline-block">e<span className="absolute -top-1 right-0 translate-x-[10px] text-[9px] font-semibold text-white/50" style={{ top: 0 }}>AI</span></span></span>
          </div>
          <div className="flex gap-8 text-[13px] text-white/50">
            <Link href="/privacy" className="hover:text-white/80 transition-colors">Privacy Policy</Link>
            <a href="mailto:support@whatyouate.app" className="hover:text-white/80 transition-colors">Support</a>
          </div>
          <span className="text-[12px] text-white/40">© {new Date().getFullYear()} WhatYouAte. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}
