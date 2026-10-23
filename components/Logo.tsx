import Image from "next/image";

/**
 * The WhatYouAte name with its AI mark, matching the app header. Sizes are relative to the name's
 * font size, so it scales; calibrated at 16px (AI 5.7px, 0.45px right of the e, 4.6px down).
 * The AI takes the name's colour at 80%.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold leading-[1.3333] tracking-[-0.015em] ${className}`}>
      WhatYouAt
      <span className="relative inline-block">
        e
        <span className="absolute left-[calc(100%+0.079em)] top-[0.807em] text-[0.35625em] font-semibold leading-none opacity-80">AI</span>
      </span>
    </span>
  );
}

/** App icon plus name, as in the site and app headers. `small` is the footer size. */
export default function Logo({ small = false, light = false, priority = false }: { small?: boolean; light?: boolean; priority?: boolean }) {
  return (
    <span className={`flex items-center ${small ? "gap-2" : "gap-2.5"}`}>
      <Image
        src={small ? "/icon.png" : "/icon-512.png"}
        alt=""
        width={small ? 22 : 30}
        height={small ? 22 : 30}
        className={small ? "rounded-[6px]" : "rounded-[8px] ring-1 ring-black/5"}
        priority={priority}
      />
      <Wordmark className={`${small ? "text-[14px]" : "text-[16px]"} ${light ? "text-white" : "text-[#1F2937]"}`} />
    </span>
  );
}
