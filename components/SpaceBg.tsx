import type { ReactNode } from "react";
import { mulberry32 } from "@/lib/jigsaw";

/**
 * Shared base wrapper: flat #050810 space plus a sparse static starfield.
 * Dots are solid white 1–2px points — no tinted or faded variants — placed
 * from a seeded PRNG so server and client render the same sky.
 */
const STARS = (() => {
  const rnd = mulberry32(20261013);
  return Array.from({ length: 60 }, () => ({
    left: Number((rnd() * 100).toFixed(3)),
    top: Number((rnd() * 100).toFixed(3)),
    size: rnd() > 0.7 ? 2 : 1,
  }));
})();

export default function SpaceBg({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="relative min-h-[100dvh] bg-space">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        {STARS.map((star, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              backgroundColor: "#ffffff",
            }}
          />
        ))}
      </div>
      <div
        className={`relative z-10 flex min-h-[100dvh] flex-col ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
