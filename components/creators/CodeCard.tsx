"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Card } from "./Shell";
import { BODY, INK } from "../site";

// A business card (3.5 x 2 in) with the creator's code and a QR code to their link, for handing to
// clients and friends. Drawn as one SVG so the preview, the printed sheet and the downloaded image
// all match. Units are CSS pixels, 96 to the inch.
const W = 336;
const H = 192;
const FONTS = "/creators/kit/fonts";
const LOGO = "/creators/kit/brand/whatyouate-logo.png";
const PER_SHEET = 10;
const FAMILY = `"WYA Card",-apple-system,"Helvetica Neue",Arial,sans-serif`;

function fontFaces(bold: string, medium: string) {
  return (
    `@font-face{font-family:"WYA Card";font-weight:700;src:url(${bold}) format("woff2")}` +
    `@font-face{font-family:"WYA Card";font-weight:500;src:url(${medium}) format("woff2")}`
  );
}

/** The QR as the inside of an <svg>, with its viewBox, so it can be nested in the card. */
function useQr(url: string) {
  const [qr, setQr] = useState<{ box: string; body: string } | null>(null);
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: INK, light: "#FFFFFF" } })
      .then((s) => {
        const box = s.match(/viewBox="([^"]+)"/)?.[1];
        const body = s.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
        if (box) setQr({ box, body });
      })
      .catch(() => {});
  }, [url]);
  return qr;
}

type Fit = { code: number; link: number };

let fontsLoading: Promise<unknown> | null = null;
/** Registers the card's font with the page, so text can be measured before the card is drawn. */
function loadFonts() {
  fontsLoading ??= Promise.all(
    [["700", "Geist-Bold"], ["500", "Geist-Medium"]].map(([weight, file]) =>
      new FontFace("WYA Card", `url(${FONTS}/${file}.woff2)`, { weight }).load().then((f) => document.fonts.add(f)),
    ),
  );
  return fontsLoading;
}

/** Font sizes that fit the code in its box and the link under the QR code, measured with the card's font. */
function useFit(code: string, link: string): Fit | null {
  const [fit, setFit] = useState<Fit | null>(null);
  useEffect(() => {
    let live = true;
    const measure = async () => {
      await loadFonts().catch(() => {});
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("style", "position:absolute;left:-9999px;top:0;visibility:hidden");
      document.body.appendChild(svg);
      const width = (text: string, size: number, weight: number, spacing: number) => {
        const t = document.createElementNS(ns, "text");
        t.setAttribute("font-size", String(size));
        t.setAttribute("font-weight", String(weight));
        t.setAttribute("letter-spacing", String(spacing));
        t.setAttribute("style", `font-family:${FAMILY}`);
        t.textContent = text;
        svg.appendChild(t);
        return t.getBBox().width;
      };
      const codeWidth = width(code, 21, 700, 21 * 0.08);
      const linkWidth = width(link.replace("https://", ""), 7.5, 500, 0);
      svg.remove();
      if (live) setFit({ code: Math.min(21, (21 * 164) / codeWidth), link: Math.min(7.5, (7.5 * 112) / linkWidth) });
    };
    measure();
    return () => {
      live = false;
    };
  }, [code, link]);
  return fit;
}

function cardSvg(code: string, link: string, qr: { box: string; body: string }, fit: Fit, logo: string, fonts: string) {
  const codeSize = fit.code;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>${fonts}text{font-family:${FAMILY}}</style>
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
<image href="${logo}" xlink:href="${logo}" x="18" y="18" width="116" height="21"/>
<text x="18" y="66" font-size="17.5" font-weight="700" fill="${INK}" letter-spacing="-0.35">Your First Month Free</text>
<text x="18" y="83" font-size="9.5" font-weight="500" fill="${BODY}">Scan to download the app, then</text>
<text x="18" y="96" font-size="9.5" font-weight="500" fill="${BODY}">enter this code when you sign up:</text>
<rect x="18" y="106" width="184" height="40" rx="10" fill="#EEF5FE" stroke="#B9D4FA" stroke-width="1.2"/>
<text x="110" y="126" font-size="${codeSize.toFixed(2)}" font-weight="700" fill="${INK}" text-anchor="middle" dominant-baseline="central" letter-spacing="${(codeSize * 0.08).toFixed(2)}">${code}</text>
<text x="18" y="172" font-size="7.5" font-weight="500" fill="${BODY}">For iPhone. New accounts only.</text>
<svg x="222" y="34" width="96" height="96" viewBox="${qr.box}" shape-rendering="crispEdges">${qr.body}</svg>
<text x="270" y="148" font-size="${fit.link.toFixed(2)}" font-weight="500" fill="${BODY}" text-anchor="middle">${link.replace("https://", "")}</text>
</svg>`;
}

async function dataUrl(path: string) {
  const blob = await (await fetch(path)).blob();
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** A 1050 x 600 PNG (300 dpi). An SVG drawn as an image can't fetch anything, so the logo and fonts go in as data. */
async function downloadPng(code: string, link: string, qr: { box: string; body: string }, fit: Fit) {
  const [logo, bold, medium] = await Promise.all([dataUrl(LOGO), dataUrl(`${FONTS}/Geist-Bold.woff2`), dataUrl(`${FONTS}/Geist-Medium.woff2`)]);
  const svg = cardSvg(code, link, qr, fit, logo, fontFaces(bold, medium));
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  // Safari can paint an SVG image before its embedded fonts are ready; a short wait covers it.
  await new Promise((r) => setTimeout(r, 150));
  const scale = 1050 / W;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `whatyouate-card-${code}.png`;
  a.click();
}

export default function CodeCard({ code }: { code: string }) {
  const link = `https://whatyouate.app/c/${code}`;
  const qr = useQr(link);
  const fit = useFit(code, link);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const svg = qr && fit ? cardSvg(code, link, qr, fit, LOGO, fontFaces(`${FONTS}/Geist-Bold.woff2`, `${FONTS}/Geist-Medium.woff2`)) : "";

  return (
    <Card className="px-5 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-xl ring-1 ring-[#16233B]/[0.1]" style={{ aspectRatio: `${W} / ${H}` }}>
        {svg && <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />}
      </div>
      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!svg}
          className="rounded-full px-5 py-3 text-[14.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: INK }}
        >
          Print Cards
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!qr || !fit || saving) return;
            setSaving(true);
            await downloadPng(code, link, qr, fit).catch(() => {});
            setSaving(false);
          }}
          disabled={!svg}
          className="rounded-full px-5 py-3 text-[14.5px] font-semibold transition hover:opacity-80 disabled:opacity-50"
          style={{ color: INK, boxShadow: `inset 0 0 0 1.5px ${INK}` }}
        >
          {saving ? "Saving…" : "Download Image"}
        </button>
      </div>
      <p className="mt-3 text-[13px] leading-[1.55]" style={{ color: BODY }}>
        Print Cards gives you a sheet of {PER_SHEET} business cards with cut lines, on regular paper or card stock. Download Image is the same card to send by message or add to a newsletter.
      </p>

      {/* Only this sheet prints: everything else on the page is hidden while printing. */}
      {mounted &&
        svg &&
        createPortal(
          <div id="wya-print-sheet">
            <style>{`
              #wya-print-sheet { display: none; }
              @media print {
                @page { size: letter; margin: 0.5in; }
                body > *:not(#wya-print-sheet) { display: none !important; }
                body { background: #fff !important; }
                #wya-print-sheet { display: grid; grid-template-columns: repeat(2, 3.5in); justify-content: center; }
                #wya-print-sheet > div { width: 3.5in; height: 2in; outline: 0.5px dashed #B8C2D1; outline-offset: -0.25px; }
                #wya-print-sheet svg { display: block; width: 3.5in; height: 2in; }
              }
            `}</style>
            {Array.from({ length: PER_SHEET }, (_, i) => (
              <div key={i} dangerouslySetInnerHTML={{ __html: svg }} />
            ))}
          </div>,
          document.body,
        )}
    </Card>
  );
}
