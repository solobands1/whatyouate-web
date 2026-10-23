"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Card } from "./Shell";
import { useDevice } from "./RedeemQr";
import { BODY, INK } from "../site";

// A business card (3.5 x 2 in) with the creator's code and a QR code to their link, for handing to
// clients and friends. One SVG is the preview and the printed sheet; renderPng draws the same layout
// for the downloaded image. Units are CSS pixels, 96 to the inch.
const W = 336;
const H = 192;
const FONTS = "/creators/kit/fonts";
const ICON = "/icon-512.png";
// The logo is the site header's (components/Logo.tsx) at 80%: drawn as the icon plus live text so it
// stays sharp at any zoom and in print. The header's icon is 30px with 8px corners, the name 16px
// starting 40px in with its baseline 19.95px down, letter spacing -0.015em; here each is x 0.8.
// The AI follows the name: dx from the end of the name, dy from its baseline, tuned so its gap, height
// and size match the header (measured against the live header). SVG ends the name's letter spacing a
// little differently from the canvas, hence its own svgDx.
const F = 0.8;
const LOGO = {
  icon: { x: 18, y: 17, size: 30 * F, radius: 8 * F },
  name: { x: 18 + 40 * F, y: 17 + 19.95 * F, size: 16 * F, spacing: -0.015 * 16 * F },
  ai: { dx: 0.5, svgDx: 0.3, dy: -7.0 * F, size: 5.7 * F },
};
const LOGO_INK = "#1F2937";
// The downloaded image: 3150 x 1800, 900 pixels to the inch, so it stays crisp when zoomed in.
const PNG_WIDTH = 3150;
const PER_SHEET = 8;
const FAMILY = `"WYA Card",-apple-system,"Helvetica Neue",Arial,sans-serif`;

function fontFaces() {
  return (["700:Bold", "600:SemiBold", "500:Medium"] as const)
    .map((w) => `@font-face{font-family:"WYA Card";font-weight:${w.split(":")[0]};src:url(${FONTS}/Geist-${w.split(":")[1]}.woff2) format("woff2")}`)
    .join("");
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
    [["700", "Geist-Bold"], ["600", "Geist-SemiBold"], ["500", "Geist-Medium"]].map(([weight, file]) =>
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

function cardSvg(code: string, link: string, qr: { box: string; body: string }, fit: Fit) {
  const codeSize = fit.code;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>${fontFaces()}text{font-family:${FAMILY}}</style>
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
<clipPath id="wya-icon"><rect x="${LOGO.icon.x}" y="${LOGO.icon.y}" width="${LOGO.icon.size}" height="${LOGO.icon.size}" rx="${LOGO.icon.radius}"/></clipPath>
<image href="${ICON}" xlink:href="${ICON}" x="${LOGO.icon.x}" y="${LOGO.icon.y}" width="${LOGO.icon.size}" height="${LOGO.icon.size}" clip-path="url(#wya-icon)"/>
<rect x="${LOGO.icon.x - F / 2}" y="${LOGO.icon.y - F / 2}" width="${LOGO.icon.size + F}" height="${LOGO.icon.size + F}" rx="${LOGO.icon.radius + F / 2}" fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="${F}"/>
<text x="${LOGO.name.x}" y="${LOGO.name.y}" font-size="${LOGO.name.size}" font-weight="600" fill="${LOGO_INK}" letter-spacing="${LOGO.name.spacing}">WhatYouAte<tspan dx="${LOGO.ai.svgDx}" dy="${LOGO.ai.dy}" font-size="${LOGO.ai.size}" letter-spacing="0">AI</tspan></text>
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

/** Shrinks an image by halves to about the size it's drawn at, so its edges stay smooth rather than jagged. */
function shrunk(img: HTMLImageElement, size: number): CanvasImageSource {
  let src: HTMLImageElement | HTMLCanvasElement = img;
  let w = img.naturalWidth;
  while (w / 2 >= size) {
    w = Math.round(w / 2);
    const c = document.createElement("canvas");
    c.width = c.height = w;
    const x = c.getContext("2d");
    if (!x) break;
    x.imageSmoothingQuality = "high";
    x.drawImage(src, 0, 0, w, w);
    src = c;
  }
  return src;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * The same card as cardSvg, drawn straight onto a canvas as a PNG_WIDTH-wide PNG. Safari won't
 * reliably turn an SVG with fonts into an image, so the download doesn't go through the SVG.
 */
async function renderPng(code: string, link: string, fit: Fit): Promise<Blob | null> {
  await loadFonts().catch(() => {});
  const icon = await loadImage(ICON);
  const s = PNG_WIDTH / W;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * s);
  canvas.height = Math.round(H * s);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(s, s);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  const { x: ix, y: iy, size: is, radius: ir } = LOGO.icon;
  ctx.save();
  roundRect(ix, iy, is, is, ir);
  ctx.clip();
  ctx.drawImage(shrunk(icon, is * s), ix, iy, is, is);
  ctx.restore();
  // The header's faint ring (ring-1 ring-black/5).
  roundRect(ix - F / 2, iy - F / 2, is + F, is + F, ir + F / 2);
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = F;
  ctx.stroke();

  // Letter spacing by hand, since older Safari has no ctx.letterSpacing.
  const text = (t: string, x: number, y: number, size: number, weight: number, color: string, opts: { spacing?: number; align?: "left" | "center"; middle?: boolean } = {}) => {
    ctx.font = `${weight} ${size}px ${FAMILY}`;
    ctx.fillStyle = color;
    ctx.textBaseline = opts.middle ? "middle" : "alphabetic";
    const spacing = opts.spacing ?? 0;
    const chars = [...t];
    // Each letter sits where the text before it ends, so the font's kerning ("Yo", "At") is kept.
    const starts = chars.map((_, i) => ctx.measureText(chars.slice(0, i).join("")).width + spacing * i);
    const total = ctx.measureText(t).width + spacing * chars.length;
    const left = opts.align === "center" ? x - total / 2 : x;
    if (!spacing) {
      ctx.fillText(t, left, y);
      return;
    }
    chars.forEach((c, i) => ctx.fillText(c, left + starts[i], y));
  };

  text("WhatYouAte", LOGO.name.x, LOGO.name.y, LOGO.name.size, 600, LOGO_INK, { spacing: LOGO.name.spacing });
  // Where the SVG's tspan lands: after the name and its trailing letter spacing.
  ctx.font = `600 ${LOGO.name.size}px ${FAMILY}`;
  const nameEnd = LOGO.name.x + ctx.measureText("WhatYouAte").width + LOGO.name.spacing * 10;
  text("AI", nameEnd + LOGO.ai.dx, LOGO.name.y + LOGO.ai.dy, LOGO.ai.size, 600, LOGO_INK);
  text("Your First Month Free", 18, 66, 17.5, 700, INK, { spacing: -0.35 });
  text("Scan to download the app, then", 18, 83, 9.5, 500, BODY);
  text("enter this code when you sign up:", 18, 96, 9.5, 500, BODY);

  const [bx, by, bw, bh, r] = [18, 106, 184, 40, 10];
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath();
  ctx.fillStyle = "#EEF5FE";
  ctx.fill();
  ctx.strokeStyle = "#B9D4FA";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  text(code, 110, 126, fit.code, 700, INK, { spacing: fit.code * 0.08, align: "center", middle: true });
  text("For iPhone. New accounts only.", 18, 172, 7.5, 500, BODY);
  text(link.replace("https://", ""), 270, 148, fit.link, 500, BODY, { align: "center" });

  // QR modules in whole device pixels, so neighbouring squares don't leave hairline gaps.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const qr = QRCode.create(link, { errorCorrectionLevel: "M" }).modules;
  const x0 = 222 * s;
  const y0 = 34 * s;
  const cell = (96 * s) / qr.size;
  ctx.fillStyle = INK;
  for (let row = 0; row < qr.size; row++) {
    for (let col = 0; col < qr.size; col++) {
      if (!qr.data[row * qr.size + col]) continue;
      const left = Math.round(x0 + col * cell);
      const top = Math.round(y0 + row * cell);
      ctx.fillRect(left, top, Math.round(x0 + (col + 1) * cell) - left, Math.round(y0 + (row + 1) * cell) - top);
    }
  }

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * Saves the image. Phones get the share sheet (Save Image, Messages and so on), since a plain download
 * on an iPhone ends up in Files. Has to run straight from the click, so the image is made beforehand.
 */
function saveImage(png: Blob, name: string, phone: boolean) {
  const file = new File([png], name, { type: "image/png" });
  if (phone && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file] }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(png);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function CodeCard({ code }: { code: string }) {
  const link = `https://whatyouate.app/c/${code}`;
  const qr = useQr(link);
  const fit = useFit(code, link);
  const [mounted, setMounted] = useState(false);
  const [png, setPng] = useState<Blob | null>(null);
  const device = useDevice();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!fit) return;
    let live = true;
    renderPng(code, link, fit)
      .then((b) => live && setPng(b))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [code, link, fit]);

  const svg = qr && fit ? cardSvg(code, link, qr, fit) : "";

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
          onClick={() => png && saveImage(png, `whatyouate-card-${code}.png`, device === "iphone" || device === "otherPhone")}
          disabled={!png}
          className="rounded-full px-5 py-3 text-[14.5px] font-semibold transition hover:opacity-80 disabled:opacity-50"
          style={{ color: INK, boxShadow: `inset 0 0 0 1.5px ${INK}` }}
        >
          {device === "iphone" || device === "otherPhone" ? "Save Image" : "Download Image"}
        </button>
      </div>
      <p className="mt-3 text-[13px] leading-[1.55]" style={{ color: BODY }}>
        Print Cards gives you a sheet of {PER_SHEET} business cards with cut lines, on regular paper or card stock. The image is the same card, to send by message or add to a newsletter.
      </p>

      {/* Only this sheet prints: everything else on the page is hidden while printing. */}
      {mounted &&
        svg &&
        createPortal(
          <div id="wya-print-sheet">
            <style>{`
              #wya-print-sheet { display: none; }
              @media print {
                @page { margin: 0.5in; }
                html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; min-height: 0 !important; }
                body > *:not(#wya-print-sheet) { display: none !important; }
                /* 2 x 4 business cards is 7 x 8 in. Shrinks to fit if the browser or printer
                   leaves less room, so it never runs off the left edge or onto a second page. */
                #wya-print-sheet { display: grid; grid-template-columns: 1fr 1fr; width: min(7in, 100%); margin: 0 auto; break-inside: avoid; }
                #wya-print-sheet > div { aspect-ratio: ${W} / ${H}; outline: 0.5px dashed #B8C2D1; outline-offset: -0.25px; }
                #wya-print-sheet svg { display: block; width: 100%; height: 100%; }
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
