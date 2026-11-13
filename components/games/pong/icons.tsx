// Berry Pong's drawn icons (flat SVG, no emoji): the On Fire flame, a little rack of bowls for the tray, and the single
// berry cut from the blueberry emoji for the flick pips. (The sound switch is the kit's SoundButton, as in every game.)
import { BOWLS } from "./rules";

type P = { size?: number; className?: string };
const box = (size: number, className?: string) => ({ width: size, height: size, className, "aria-hidden": true as const, focusable: "false" as const });

export function FlameIcon({ size = 18, className }: P) {
  return (
    <svg viewBox="0 0 24 24" {...box(size, className)}>
      <path d="M12.2 1.8c.6 3.4 4.9 5.6 5.9 9.6 1.2 4.8-1.8 9.8-6.3 9.8-4 0-6.9-3.1-6.6-7 .2-2.6 1.6-4.2 2.9-5.6.2 1.6.9 2.8 2.1 3.4-.6-3.9.4-7.4 2-10.2z" fill="#FF8A3D" />
      <path d="M12.3 9.6c.3 2 2.9 3.4 3.1 6 .2 2.7-1.5 4.6-3.6 4.6-2 0-3.5-1.5-3.4-3.6.1-1.5 1-2.5 1.8-3.3.1 1 .5 1.7 1.2 2 .1-2.2.2-3.9.9-5.7z" fill="#FFD25C" />
      <path d="M12.2 15.4c.2 1 1.3 1.7 1.3 2.9 0 1.1-.6 1.8-1.4 1.8s-1.4-.6-1.4-1.5c0-.9.8-1.6 1.5-3.2z" fill="#FFF6D6" />
    </svg>
  );
}

/** A side's 6 bowls from above, filled while standing and a dashed ring once sunk, laid out as they sit on the board:
 *  `near` (your end) has the point up, the far end has it down. */
export function RackIcon({ standing, color, edge, near, size = 34 }: { standing: boolean[]; color: string; edge: string; near: boolean; size?: number }) {
  // BOWLS is the triangle as the thrower sees it: back row at the far end, the point toward the thrower
  const pts = BOWLS.map(([x, y]) => {
    const row = (BOWLS[0][1] - y) / 11.778, px = (x / 13.6) * 5.6;
    return [12 + (near ? -px : px), near ? 14.6 - row * 4.9 : 5 + row * 4.9] as const;
  });
  return (
    <svg viewBox="0 0 24 20" width={size} height={(size * 20) / 24} aria-hidden className="block shrink-0">
      {pts.map(([x, y], i) => standing[i]
        ? <g key={i}><circle cx={x} cy={y + 0.5} r={2.6} fill={edge} /><circle cx={x} cy={y} r={2.6} fill={color} /><circle cx={x} cy={y} r={1.5} fill="#ffffff" opacity="0.9" /></g>
        : <circle key={i} cx={x} cy={y} r={2.2} fill="none" stroke={edge} strokeOpacity={0.45} strokeWidth={0.8} strokeDasharray="1.2 1" />)}
    </svg>
  );
}

/** The single front berry of the blueberry emoji (public/games/foods/1fad0.png), as a round chip. */
export function BerryDot({ size = 18, dim = false, className = "" }: { size?: number; dim?: boolean; className?: string }) {
  const k = size / 81;   // the front berry is about 81 px across in the 160 px image, from (6.5, 70.5)
  return (
    <span aria-hidden className={`bp-pip inline-block shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size, backgroundImage: "url(/games/foods/1fad0.png)", backgroundSize: `${160 * k}px ${160 * k}px`,
        backgroundPosition: `${-6.5 * k}px ${-70.5 * k}px`, opacity: dim ? 0.28 : 1, filter: dim ? "grayscale(0.6)" : undefined, transform: dim ? "scale(0.86)" : undefined }} />
  );
}
