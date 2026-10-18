"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { INK, BODY } from "../site";

const TABS = [
  { href: "/creators/dashboard", label: "Dashboard" },
  { href: "/creators/kit", label: "Creator kit" },
  { href: "/creators/profile", label: "Profile" },
];

/** Tabs shared by the signed-in creator pages, with log out on the right. */
export default function CreatorNav() {
  const path = usePathname()?.replace(/\/$/, "");
  return (
    <div className="flex items-center justify-between gap-3">
      <nav className="flex gap-1 rounded-full bg-white/70 p-1 ring-1 ring-[#16233B]/[0.06] backdrop-blur-sm">
        {TABS.map((t) => {
          const on = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-full px-3.5 py-2 text-[13.5px] font-semibold tracking-[-0.01em] transition sm:px-4"
              style={on ? { background: INK, color: "#fff" } : { color: BODY }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Link href="/creators" className="shrink-0 text-[13.5px] font-semibold" style={{ color: BODY }}>
        Log out
      </Link>
    </div>
  );
}
