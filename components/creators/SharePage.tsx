"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { DownloadButton, BODY, INK } from "../site";
import { normalizeCode } from "./shared";
import { publicName } from "./api";

export default function SharePage() {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    // /c/SARAH is rewritten to this page, so read the code from the path, or ?code= as a fallback.
    const fromPath = window.location.pathname.split("/").filter(Boolean)[1] ?? "";
    const fromQuery = new URLSearchParams(window.location.search).get("code") ?? "";
    const c = normalizeCode(fromPath || fromQuery);
    setCode(c);
    if (c) publicName(c).then(setName).catch(() => {});
  }, []);

  // Downloading copies the code, so the Paste button in the app can fill it in.
  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  return (
    <div className="flex min-h-screen flex-col items-center px-6 pb-16 pt-16 text-center">
      <Image src="/icon-512.png" alt="WhatYouAte" width={76} height={76} className="rounded-[20px] ring-1 ring-black/5" priority />
      <p className="mt-6 text-[15px] font-semibold" style={{ color: "#2F6FC4" }}>
        {name ? `${name} Sent You` : "You've Been Invited"}
      </p>
      <h1 className="mt-3 max-w-[22rem] text-balance text-[clamp(30px,8vw,42px)] font-bold leading-[1.08] tracking-[-0.04em]" style={{ color: INK }}>
        Get Your First Month Free
      </h1>
      <p className="mt-4 max-w-[24rem] text-[16.5px] leading-[1.65]" style={{ color: BODY }}>
        Log what you eat and how you feel. WhatYouAte shows you which foods give you energy and which ones drag you down.
      </p>

      <div
        className="mt-9 w-full max-w-[24rem] rounded-3xl bg-white/80 px-6 py-6 text-left ring-1 ring-[#16233B]/[0.06]"
        style={{ boxShadow: "0 18px 40px -26px rgba(16,42,86,0.28)" }}
      >
        <div className="flex gap-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: "#6FA8FF" }}>1</span>
          <p className="text-[15.5px] leading-[1.55]" style={{ color: INK }}>Download WhatYouAte from the App Store.</p>
        </div>
        <div className="mt-4 flex gap-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: "#6FA8FF" }}>2</span>
          <p className="text-[15.5px] leading-[1.55]" style={{ color: INK }}>When you sign up, enter this code:</p>
        </div>
        {code && (
          <button
            type="button"
            onClick={copyCode}
            className="mt-4 flex w-full items-center justify-between rounded-2xl px-5 py-4 transition"
            style={{ background: "#EEF5FE", boxShadow: "inset 0 0 0 1.5px #B9D4FA" }}
          >
            <span className="text-[24px] font-bold tracking-[0.08em]" style={{ color: INK }}>{code}</span>
            <span className="text-[14px] font-semibold" style={{ color: copied ? "#15803D" : "#2F6FC4" }}>
              {copied ? "Copied" : "Tap to copy"}
            </span>
          </button>
        )}
      </div>

      <div onClickCapture={copyCode}>
        <DownloadButton className="mt-8" />
      </div>
      <p className="mt-4 text-[13px] text-white/85">Free on iPhone. Code applies to new accounts.</p>
    </div>
  );
}
