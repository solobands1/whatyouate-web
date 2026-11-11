"use client";

// A little picture on the job cards for Pat's Fall Chores: Pat with a stick by his cart, the tractor in the leaves,
// Pat's blue '67 with the new tire, Linda riding in the cart behind Pat (waving). Drawn with the game's own drawings.
import { useEffect, useRef } from "react";
import { drawMower, drawTree } from "./art";
import { PAINTS } from "./jobs";
import { drawCart, drawCar, drawPat, drawStick, drawTire, scatterLeaves, drawLinda } from "./fallArt";
import { mulberry32 } from "./geo";
import { drawWinterCardArt, isWinterArt, type WinterArtKind } from "./winterArt";   // Chapter 4
import { drawSummerCard, isSummerCard, type SummerCardKind } from "./summerArt";   // Chapter 6
import { drawSpringCard, type SpringCardKind } from "./springArt";   // Chapter 5

export type CardArtKind = "sticks" | "leaves" | "tire" | "ride" | WinterArtKind | SpringCardKind | SummerCardKind;
const blobs = (seed: number) => { const r = mulberry32(seed), out: number[][] = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(), d = 0.45 + r() * 0.2; out.push([Math.cos(a) * d, Math.sin(a) * d, 0.42 + r() * 0.12, r()]); } return out; };

export function drawCardArt(c: CanvasRenderingContext2D, kind: CardArtKind, W: number, H: number, t: number, done = false) {
  if (isWinterArt(kind)) { drawWinterCardArt(c, kind, W, H, t, done); return; }   // Chapter 4: Pat's Winter
  if (isSummerCard(kind)) { drawSummerCard(c, kind, W, H, t, done); return; }   // Chapter 6
  if (kind !== "sticks" && kind !== "leaves" && kind !== "tire" && kind !== "ride") { drawSpringCard(c, kind, W, H, t, done); return; }   // Chapter 5 (after winter and summer)
  c.save();
  // the lawn: soft stripes with a warm fall wash
  for (let k = 0; k * 22 < W + 22; k++) { c.fillStyle = k % 2 ? "#98c463" : "#8ab857"; c.fillRect(k * 22, 0, 22, H); }
  c.fillStyle = "rgba(255,200,120,0.18)"; c.fillRect(0, 0, W, H);
  const S = Math.min(H / 2.9, W / 9.2); c.translate(W / 2, H / 2); c.scale(S, S);
  const r = mulberry32(kind.length * 13);
  scatterLeaves(c, r, 0, 0, W / S / 2, kind === "leaves" ? 160 : 28, 0.16);
  const paint = PAINTS.orange;
  if (kind === "sticks") {
    drawCart(c, -2.9, 0.25, 0, 1.55, { sticks: done ? 6 : 3 });
    drawMower(c, -0.4, 0.25, 0, 0, 0, t, false, 0.62, paint, false, false, { empty: true });
    drawStick(c, { x: 2.6, y: -0.6, a: 0.5, len: 1.2, seed: 5 });
    drawPat(c, 1.5, 0.7, -0.15 + Math.sin(t * 0.8) * 0.05, { walk: 0, carry: "stick", seed: 3, wave: done ? 1 : 0 }, t, 1.3);
  } else if (kind === "leaves") {
    c.save(); c.translate(-W / S / 2 + 1.0, -1.2); c.scale(2.2, 2.2); drawTree(c, { x: 0, y: 0, r: 1 }, blobs(7), 1, t, 1); c.restore();
    c.save(); c.translate(W / S / 2 - 0.8, 1.5); c.scale(1.6, 1.6); drawTree(c, { x: 0, y: 0, r: 1 }, blobs(12), 1, t, 1); c.restore();
    c.fillStyle = "#8ab857"; c.fillRect(-W / S, -0.95, W / S * 2, 1.9);   // the strip he's already picked up
    drawMower(c, 0.4, 0, 0, 0, 0, t, true, 1.7, paint, true, false, { wave: done ? 1 : 0 });
  } else if (kind === "tire") {
    drawCar(c, -0.6, 0.1, 0, 0, { t });
    drawTire(c, 2.4, 0.9, 0.2, t);
    drawPat(c, 2.6, -0.2, Math.PI * 0.85, { walk: 0, wave: done ? 1 : 0 }, t, 1.3);
  } else {
    c.save(); c.translate(-1.9, 0.05); c.scale(1.5, 1.5); drawCart(c, 0, 0, 0, 1.55, { linda: { t, wave: 0.5 + 0.5 * Math.sin(t * 0.6) } }); c.restore();
    drawMower(c, 1.55, 0.05, 0, 0, 0, t, true, 0.62, paint, false, false, { wave: done ? 1 : 0 });
    const hb = Math.sin(t * 2) * 0.05; c.save(); c.globalAlpha = 0.95; c.translate(-1.25, -0.85 + hb); c.scale(0.55, 0.55);   // a little heart by Linda
    c.fillStyle = "#e8506a"; c.beginPath(); c.moveTo(0, 0.3); c.bezierCurveTo(-0.6, -0.1, -0.3, -0.6, 0, -0.25); c.bezierCurveTo(0.3, -0.6, 0.6, -0.1, 0, 0.3); c.fill(); c.restore();
  }
  c.restore();
}

/** A close-up of Linda in her cart (for the ride's cards). */
export function drawLindaClose(c: CanvasRenderingContext2D, W: number, H: number, t: number) {
  c.fillStyle = "#8ab857"; c.fillRect(0, 0, W, H);
  c.save(); c.translate(W / 2, H / 2); c.scale(H / 1.8, H / 1.8); drawLinda(c, 0, 0, 0, t, 0.5 + 0.5 * Math.sin(t)); c.restore();
}

export default function CardArt({ kind, done = false, tall = false }: { kind: CardArtKind; done?: boolean; tall?: boolean }) {   // (Chapter 6: tall, the finale's end card)
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const c = cv.getContext("2d")!; c.setTransform(dpr, 0, 0, dpr, 0, 0); drawCardArt(c, kind, W, H, now / 1000, done);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [kind, done]);
  return <canvas ref={ref} aria-hidden className={`mt-2 block w-full rounded-2xl ${tall ? "h-[130px] [@media(max-height:700px)]:h-[84px]" : "h-[92px] [@media(max-height:700px)]:h-[64px]"}`} />;
}
