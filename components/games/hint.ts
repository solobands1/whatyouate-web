// The first-move hint the games draw on their canvas ("Drag Back To Putt", "Drag Back To Throw", "Drag Back Anywhere
// Here"), one look for every game, in the WhatYouAte style: a small white pill with a hairline pale blue edge and a soft
// shadow, the words in the site's Geist (ink), and two small blue chevrons nudging the way to drag. The pill sizes
// itself to its words. Plain canvas code, so the kit, Kitchen Golf's HUD and Berry Pong's art can all share it.
import { HUD_FONT } from "./gameFont";

export type HintDir = "left" | "down";

/** Draws the hint centred on cx with its top at y. `t` is the clock in ms (for the gentle pulse and the chevrons). */
export function drawHint(c: CanvasRenderingContext2D, cx: number, y: number, label: string, t: number, dir: HintDir = "left") {
  const h = 30, padL = 12, padR = 15, gap = 7, iconW = 12;
  c.save();
  c.font = `700 14px ${HUD_FONT}`;
  const tw = c.measureText(label).width, w = Math.round(padL + iconW + gap + tw + padR), x = Math.round(cx - w / 2);
  const a = 0.92 + 0.08 * Math.sin(t / 300), slide = ((t / 700) % 1) * 3;
  c.globalAlpha = a;
  c.fillStyle = "rgba(31,70,140,0.08)"; c.beginPath(); c.roundRect(x - 1, y + 4, w + 2, h, h / 2); c.fill();
  c.fillStyle = "rgba(31,70,140,0.1)"; c.beginPath(); c.roundRect(x, y + 2, w, h, h / 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.97)"; c.beginPath(); c.roundRect(x, y, w, h, h / 2); c.fill();
  c.strokeStyle = "#DCE8FA"; c.lineWidth = 1; c.beginPath(); c.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, h / 2 - 0.5); c.stroke();
  // two small chevrons, the leading one solid and the other faint, drifting the way to drag
  c.strokeStyle = "#6FA8FF"; c.lineWidth = 2; c.lineCap = "round"; c.lineJoin = "round";
  const ix = x + padL, iy = y + h / 2;
  for (let i = 0; i < 2; i++) {
    c.globalAlpha = a * (i ? 1 : 0.45);
    c.beginPath();
    if (dir === "left") { const xx = ix + 7 - i * 5 - slide; c.moveTo(xx + 3, iy - 4); c.lineTo(xx - 1, iy); c.lineTo(xx + 3, iy + 4); }
    else { const yy = iy - 5 + i * 4.5 + slide; c.moveTo(ix + 2, yy); c.lineTo(ix + 6, yy + 3.5); c.lineTo(ix + 10, yy); }
    c.stroke();
  }
  c.globalAlpha = a; c.fillStyle = "#101B2E"; c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.fillText(label, ix + iconW + gap, iy + 5);
  c.restore();
}
