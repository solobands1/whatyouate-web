"use client";

// Pat's Lawnmower moved to its own site. This page carries Pat's saved progress with him: it reads the game's three save
// keys from this phone, puts them in the new address after #carry= (base64 of a small JSON), and forwards there. The new
// site takes them in only if that phone has no save yet. With no save here, it just forwards.
import { useEffect } from "react";

const NEW_HOME = "https://minimul.app/pat";
const KEYS = ["pats-lawnmower-save", "pats-lawnmower-zoom", "pats-lawnmower-carzoom"];

export default function MovePat() {
  useEffect(() => {
    let target = NEW_HOME;
    try {
      const data: Record<string, string> = {};
      for (const k of KEYS) { const v = localStorage.getItem(k); if (v !== null) data[k] = v; }
      if (data[KEYS[0]]) {
        const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        target = `${NEW_HOME}#carry=${b64}`;
      }
    } catch {}
    window.location.replace(target);
  }, []);
  return (
    <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef6e3", color: "#1f2c17", fontFamily: "system-ui, -apple-system, sans-serif", padding: 24, textAlign: "center" }}>
      <div>
        <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Pat&apos;s Lawnmower Has Moved</p>
        <p style={{ fontSize: 15, margin: "10px 0 18px", opacity: 0.8 }}>Taking you there now, with your progress.</p>
        <a href={NEW_HOME} style={{ display: "inline-block", padding: "12px 22px", borderRadius: 999, background: "#3b7a2a", color: "#fff", fontWeight: 700, textDecoration: "none" }}>Go To The Game</a>
      </div>
    </main>
  );
}
