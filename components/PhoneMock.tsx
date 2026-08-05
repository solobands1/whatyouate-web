import Image from "next/image";

/**
 * A realistic iPhone, turned in 3D space.
 *
 * The frame is a titanium gradient with real side buttons and an inner bezel
 * highlight, so at large sizes it holds up as a device rather than a rounded
 * rectangle. The whole thing is transformed on one perspective wrapper, which
 * keeps the screenshot pin-sharp instead of being redrawn per layer.
 */
export default function PhoneMock({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const btn: React.CSSProperties = {
    position: "absolute",
    width: "1.6%",
    background: "linear-gradient(90deg,#2b2d31 0%,#5a5d63 45%,#26282c 100%)",
    borderRadius: 2,
  };

  return (
    <div className={className} style={{ perspective: "1800px", perspectiveOrigin: "60% 40%" }}>
      <div
        className="relative"
        style={{ transform: "rotateY(-17deg) rotateX(5deg) rotate(1.2deg)", transformStyle: "preserve-3d" }}
      >
        {/* grounded shadow, cast rather than drawn around the edge */}
        <div
          aria-hidden
          className="absolute inset-x-[6%] bottom-[-3%] h-[12%] rounded-[50%] blur-2xl"
          style={{ background: "rgba(15,40,85,0.38)" }}
        />

        {/* side buttons sit under the body so only their outer edge shows */}
        <div style={{ ...btn, left: "-1.1%", top: "16%", height: "5.5%" }} />
        <div style={{ ...btn, left: "-1.1%", top: "25%", height: "9%" }} />
        <div style={{ ...btn, left: "-1.1%", top: "36%", height: "9%" }} />
        <div style={{ ...btn, right: "-1.1%", top: "27%", height: "13%" }} />

        {/* titanium body */}
        <div
          className="relative rounded-[12.6%] p-[1.5%]"
          style={{
            background:
              "linear-gradient(145deg,#63666c 0%,#2a2c30 26%,#4b4e54 46%,#212327 66%,#494c52 84%,#26282c 100%)",
            boxShadow: [
              "inset 0 0 0 1px rgba(255,255,255,0.20)",
              "inset 0 1px 1px rgba(255,255,255,0.28)",
              "0 0 0 1px rgba(0,0,0,0.55)",
              "0 60px 90px -40px rgba(12,35,75,0.55)",
            ].join(", "),
          }}
        >
          <div className="overflow-hidden rounded-[11.2%] bg-black">
            <Image
              src={src}
              alt={alt}
              width={760}
              height={1651}
              priority={priority}
              className="block w-full"
            />
          </div>

          {/* a single soft sheen across the glass */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[12.6%]"
            style={{
              background:
                "linear-gradient(118deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.06) 26%, rgba(255,255,255,0) 46%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
