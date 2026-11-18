// Berry Pong's drawn icons (flat SVG, no emoji): the On Fire flame, a little rack of bowls for the tray, the single
// berry cut from the blueberry emoji for the flick pips, and one for each trick shot. (The sound switch is the kit's SoundButton, as in every game.)
import { BOWLS, type Trick } from "./rules";

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

/** A trick shot's icon, in the site's blues: the berry's path (dashed) and where it went in. Bank Shot: down to the
 *  table and up into a bowl. Rim Roll: a loop round a bowl's rim. Bowl Hop: off one bowl and into the next. */
export function TrickIcon({ kind, size = 30, className }: P & { kind: Trick }) {
  const bowl = (cx: number, cy: number, w: number) => (
    <g>
      <path d={`M${cx - w / 2} ${cy}h${w}c0 ${w * 0.55}-${w * 0.22} ${w * 0.62}-${w / 2} ${w * 0.62}s-${w / 2}-${w * 0.07}-${w / 2}-${w * 0.62}z`} fill="#6FA8FF" />
      <ellipse cx={cx} cy={cy} rx={w / 2} ry={w * 0.16} fill="#EAF2FF" stroke="#4F88E8" strokeWidth="1.3" />
    </g>
  );
  const path = { fill: "none", stroke: "#4F88E8", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeDasharray: "2.2 2.4" };
  return (
    <svg viewBox="0 0 32 32" {...box(size, className)}>
      {kind === "bank" && <>
        <path d="M2.5 27.5h17" stroke="#B9C9E3" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M4 5.5c3.4.4 5.6 9 7.4 21.4C13.2 17 18 12.6 23 16" {...path} />
        {bowl(24.5, 17.5, 10)}
        <circle cx="4" cy="5.5" r="2.6" fill="#2F5FB0" />
      </>}
      {kind === "rim" && <>
        {bowl(16, 18, 16)}
        <path d="M6.5 14.2C8 8.6 24 8.6 25.5 14.2" {...path} strokeDasharray="none" />
        <path d="M25.9 10.8l-.3 3.9-3.7-1.2" fill="none" stroke="#4F88E8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7" cy="13.6" r="2.6" fill="#2F5FB0" />
      </>}
      {kind === "hop" && <>
        {bowl(8.5, 20, 11)}
        {bowl(23.5, 20, 11)}
        <path d="M3 6c3 0 5.6 4.5 7.6 12.4C12.4 11 17 8.6 23.5 18" {...path} />
        <circle cx="3" cy="6" r="2.4" fill="#2F5FB0" />
      </>}
    </svg>
  );
}
