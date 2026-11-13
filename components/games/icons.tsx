// Drawn icons for the game frame (buttons, badges, the scoreboard and the games hub), so no control relies on an emoji.
// Plain SVG with flat fills: safe in server components (the hub) and client ones (the kit).
type P = { size?: number; className?: string; color?: string };
const box = (size: number, className?: string) => ({ width: size, height: size, className, "aria-hidden": true as const, focusable: "false" as const });

export function BackIcon({ size = 18, className, color = "currentColor" }: P) {
  return <svg viewBox="0 0 24 24" {...box(size, className)}><path d="M14.8 5.2 8 12l6.8 6.8" fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function InfoIcon({ size = 18, className, color = "currentColor" }: P) {
  return <svg viewBox="0 0 24 24" {...box(size, className)}><circle cx="12" cy="5.6" r="2.4" fill={color} /><rect x="9.8" y="9.4" width="4.4" height="11" rx="2.2" fill={color} /></svg>;
}

export function TrophyIcon({ size = 20, className }: P) {   // in the WhatYouAte blue, like the site's icons
  return (
    <svg viewBox="0 0 32 32" {...box(size, className)}>
      <path d="M9.2 8.2H5.6c-.9 0-1.5.7-1.4 1.6.4 3.6 2.7 6 6.2 6.6M22.8 8.2h3.6c.9 0 1.5.7 1.4 1.6-.4 3.6-2.7 6-6.2 6.6" fill="none" stroke="#4F88E8" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8.4 4.6h15.2v7.2c0 4.4-3.4 8-7.6 8s-7.6-3.6-7.6-8z" fill="#DCEBFF" stroke="#4F88E8" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M11.6 7.6v3.8c0 1.7.6 3.2 1.6 4.3" fill="none" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" />
      <rect x="13.9" y="19.4" width="4.2" height="4.4" fill="#9CC4FF" stroke="#4F88E8" strokeWidth="1.3" />
      <rect x="9.6" y="23.2" width="12.8" height="5" rx="1.8" fill="#4F88E8" />
      <rect x="11.4" y="24.6" width="9.2" height="1.4" rx="0.7" fill="#DCEBFF" />
    </svg>
  );
}

export function PauseIcon({ size = 14, className, color = "currentColor" }: P) {
  return <svg viewBox="0 0 24 24" {...box(size, className)}><rect x="4.5" y="3.5" width="5.6" height="17" rx="2" fill={color} /><rect x="13.9" y="3.5" width="5.6" height="17" rx="2" fill={color} /></svg>;
}

export function PlayIcon({ size = 16, className, color = "currentColor" }: P) {
  return <svg viewBox="0 0 24 24" {...box(size, className)}><path d="M7.2 4.4c0-1.2 1.3-1.9 2.3-1.3l10.2 7.6c.8.6.8 1.9 0 2.5L9.5 20.9c-1 .7-2.3 0-2.3-1.3z" fill={color} /></svg>;
}

export function ReplayIcon({ size = 18, className, color = "currentColor" }: P) {
  return (
    <svg viewBox="0 0 24 24" {...box(size, className)}>
      <path d="M19.6 14.2A8 8 0 1 1 17.4 6" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M21.4 2.6v7.6h-7.6z" fill={color} stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function ShareIcon({ size = 18, className, color = "currentColor" }: P) {
  return (
    <svg viewBox="0 0 24 24" {...box(size, className)}>
      <path d="M8.4 9.6H7a2 2 0 0 0-2 2v7.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7.4a2 2 0 0 0-2-2h-1.4" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12 14.4V3.4M8.2 7 12 3.2 15.8 7" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon({ size = 16, className, color = "currentColor" }: P) {
  return <svg viewBox="0 0 24 24" {...box(size, className)}><path d="M6 6l12 12M18 6 6 18" fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="round" /></svg>;
}

export function CheckIcon({ size = 14, className, color = "currentColor" }: P) {
  return <svg viewBox="0 0 24 24" {...box(size, className)}><path d="M5 12.6l4.4 4.4L19 7.4" fill="none" stroke={color} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function StarIcon({ size = 18, className, color = "#6FA8FF", edge = "#4F88E8" }: P & { edge?: string }) {
  return (
    <svg viewBox="0 0 24 24" {...box(size, className)}>
      <path d="M12 2.6l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.4l-5.4 2.9 1.1-6.1L3.2 9l6.1-.8z" fill={color} stroke={edge} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.6 9.4l1.4-2.8" stroke="#EAF2FF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** A podium medal for the top three on a scoreboard. */
export function MedalIcon({ rank, size = 30, className }: { rank: 1 | 2 | 3; size?: number; className?: string }) {
  const c = [["#FFC21F", "#C98A00", "#FFF1A8"], ["#D5DEEA", "#8796AD", "#FFFFFF"], ["#E9A267", "#A65F2A", "#FFD9B5"]][rank - 1];
  return (
    <svg viewBox="0 0 32 32" {...box(size, className)}>
      <path d="M9 2.5h5.2l3.2 8.2-4.6 2.2zM23 2.5h-5.2l-3.2 8.2 4.6 2.2z" fill={rank === 1 ? "#3F7FD6" : rank === 2 ? "#E8505B" : "#22A964"} />
      <path d="M11.2 2.5h1.4l3 7.6-1.2.6zM20.8 2.5h-1.4l-3 7.6 1.2.6z" fill="#ffffff" opacity="0.45" />
      <circle cx="16" cy="19.5" r="10" fill={c[0]} stroke={c[1]} strokeWidth="1.8" />
      <circle cx="16" cy="19.5" r="7" fill="none" stroke={c[1]} strokeWidth="1" opacity="0.55" />
      <path d="M10.6 16.4a6.4 6.4 0 0 1 4-3.4" fill="none" stroke={c[2]} strokeWidth="1.8" strokeLinecap="round" />
      <text x="16" y="23.6" textAnchor="middle" fontFamily='"Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif' fontSize="12" fill={c[1]}>{rank}</text>
    </svg>
  );
}

export function PlayersIcon({ size = 16, className, color = "currentColor" }: P) {
  return (
    <svg viewBox="0 0 24 24" {...box(size, className)}>
      <circle cx="8.4" cy="7.6" r="3.6" fill={color} />
      <path d="M1.8 19.4c.4-3.8 3.1-6.2 6.6-6.2s6.2 2.4 6.6 6.2c.1.7-.4 1.2-1.1 1.2H2.9c-.7 0-1.2-.5-1.1-1.2z" fill={color} />
      <circle cx="16.6" cy="8.4" r="3.1" fill={color} opacity="0.75" />
      <path d="M16.2 13.4c3.4-.3 5.7 2 6 5.6.1.6-.4 1.1-1 1.1h-4.4c.1-2.6-.2-4.8-.6-6.7z" fill={color} opacity="0.75" />
    </svg>
  );
}

export function CalendarIcon({ size = 16, className, color = "currentColor" }: P) {
  return (
    <svg viewBox="0 0 24 24" {...box(size, className)}>
      <rect x="3" y="5" width="18" height="16" rx="3.4" fill="none" stroke={color} strokeWidth="2.4" />
      <path d="M3.4 10h17.2" stroke={color} strokeWidth="2.4" />
      <path d="M8 2.8v4M16 2.8v4" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12 12.6l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" fill={color} />
    </svg>
  );
}

export function SwordsIcon({ size = 18, className, color = "currentColor" }: P) {
  return (
    <svg viewBox="0 0 24 24" {...box(size, className)}>
      <path d="M3.4 3.4h4.4l9 9-2.2 2.2-9-9zM20.6 3.4h-4.4l-9 9 2.2 2.2 9-9z" fill={color} />
      <path d="M14 17.2l3.4-3.4M10 17.2l-3.4-3.4" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M17.6 17.6l3 3M6.4 17.6l-3 3" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function HeartIcon({ size = 14, className, color = "#FF5D6C" }: P) {
  return (
    <svg viewBox="0 0 24 24" {...box(size, className)}>
      <path d="M12 21s-8.6-5.2-8.6-11.4C3.4 6.6 5.7 4.4 8.4 4.4c1.6 0 2.9.8 3.6 2 .7-1.2 2-2 3.6-2 2.7 0 5 2.2 5 5.2C20.6 15.8 12 21 12 21z" fill={color} stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
      <path d="M7 8.6c.3-1 1-1.6 1.9-1.8" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function SparkleIcon({ size = 20, className, color = "currentColor" }: P) {
  return (
    <svg viewBox="0 0 24 24" {...box(size, className)}>
      <path d="M12 2.4c.6 4.6 2.8 6.9 7.6 7.6-4.8.7-7 3-7.6 7.6-.6-4.6-2.8-6.9-7.6-7.6 4.8-.7 7-3 7.6-7.6z" fill={color} />
      <path d="M19 15.4c.3 2 1.2 3 3.2 3.2-2 .3-2.9 1.2-3.2 3.2-.3-2-1.2-2.9-3.2-3.2 2-.2 2.9-1.2 3.2-3.2z" fill={color} opacity="0.7" />
    </svg>
  );
}

/** Pass the phone: a phone with a curved arrow round it, in the WhatYouAte blue. */
export function PassPhoneIcon({ size = 32, className, color = "#4F88E8" }: P) {
  return (
    <svg viewBox="0 0 32 32" {...box(size, className)}>
      <rect x="10.5" y="5" width="11" height="20" rx="2.6" fill="#ffffff" stroke={color} strokeWidth="2" />
      <path d="M14.4 7.6h3.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="21.6" r="1.2" fill={color} />
      <path d="M4.6 17.5a11.6 11.6 0 0 0 18.5 8.2" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M20.9 27.6l2.5-1.9-1.4-2.8" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <path d="M27.4 14.5A11.6 11.6 0 0 0 8.9 6.3" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M11.1 4.4L8.6 6.3l1.4 2.8" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
    </svg>
  );
}

/** Shuffle: two crossing arrows. */
export function ShuffleIcon({ size = 18, className, color = "currentColor" }: P) {
  return (
    <svg viewBox="0 0 24 24" {...box(size, className)}>
      <path d="M3.5 7h3.2c2 0 3.2.9 4.3 2.6l2 3c1.1 1.7 2.3 2.4 4.3 2.4h3.2M3.5 17h3.2c1.6 0 2.7-.5 3.6-1.6M14 8.6c.9-1.1 2-1.6 3.6-1.6h2.9" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.8 4.3l2.7 2.7-2.7 2.7M17.8 12.3l2.7 2.7-2.7 2.7" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The sound toggle: a speaker with sound waves when on, with a cross when off. */
export function SoundIcon({ on, size = 18, className, color = "currentColor" }: P & { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...box(size, className)}>
      <path d="M2.6 9.6c0-.9.7-1.6 1.6-1.6h2.9l4.5-3.8c.9-.8 2.3-.1 2.3 1.1v13.4c0 1.2-1.4 1.9-2.3 1.1L7.1 16H4.2c-.9 0-1.6-.7-1.6-1.6z" fill={color} />
      {on ? (<>
        <path d="M16.6 8.9a4.4 4.4 0 0 1 0 6.2" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M19.2 6.2a8.2 8.2 0 0 1 0 11.6" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      </>) : (
        <path d="M16.6 9.4l4.8 5.2M21.4 9.4l-4.8 5.2" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
      )}
    </svg>
  );
}
