import type { Metadata } from "next";

// Pat's Lawnmower: a private game (hidden: noindex, not on the games page, menu or sitemap).
// This is a short "almost ready" page; the game replaces it when it's finished.
export const metadata: Metadata = {
  title: "Pat's Lawnmower",
  description: "Help Pat finish the lawn before the cat gets in the way.",
  robots: { index: false, follow: false },
};

export default function PatPage() {
  return (
    <main className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-[#e8f6dc] to-[#9fd383] p-6 text-center text-[#1f3a14]">
      <div className="max-w-[340px] rounded-3xl bg-white/90 p-7 shadow-xl">
        <div className="text-5xl">🚜</div>
        <h1 className="mt-3 text-2xl font-bold">Pat&apos;s Lawnmower</h1>
        <p className="mt-2 text-[15px] leading-snug text-[#3d5a2e]">Almost ready. Pat&apos;s just gassing up the tractor.</p>
        <p className="mt-4 text-sm text-[#5a7a4a]">Check back soon. 🐈‍⬛</p>
      </div>
    </main>
  );
}
