"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Device = "iphone" | "otherPhone" | "computer";

/** iPhone (redeem directly), another phone (can't redeem Apple codes) or a computer (scan the QR). */
export function useDevice(): Device | null {
  const [device, setDevice] = useState<Device | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent;
    // iPadOS reports itself as a Mac, so a touch-screen "Mac" is an iPad.
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const phone = /Android|Mobi/.test(ua);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevice(ios ? "iphone" : phone ? "otherPhone" : "computer");
  }, []);
  return device;
}

/** A QR code for the redeem link, so someone on a computer can scan it with their iPhone. */
export default function RedeemQr({ url }: { url: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#101B2E", light: "#FFFFFF" } })
      .then(setSvg)
      .catch(() => {});
  }, [url]);
  if (!svg) return null;
  return (
    <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-3 ring-1 ring-[#16233B]/[0.08]">
      <div className="h-24 w-24 shrink-0" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-[13.5px] leading-[1.55] text-[#5B6B85]">
        <span className="font-semibold text-[#101B2E]">On a computer?</span>{" "}
        Scan this with your iPhone&apos;s camera to redeem it there.
      </p>
    </div>
  );
}
