"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "ghost" | "primary" | "danger";

/**
 * Cockpit button: square, hairline border, mono uppercase label.
 * Ghost: black ground / ink text; hover inverts to ink ground / space text.
 * Primary: permanently inverted.
 * Danger: for the single error/lock indicator on a screen. Never a normal
 * action button.
 */
const VARIANTS: Record<Variant, string> = {
  ghost:
    "border-white/25 text-ink hover:bg-ink hover:text-space hover:border-ink",
  primary: "border-ink bg-ink text-space hover:bg-ink hover:text-space",
  danger:
    "border-danger text-danger hover:bg-danger hover:text-space hover:border-danger",
};

export default function TerminalButton({
  children,
  className = "",
  variant = "ghost",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex cursor-pointer touch-manipulation items-center justify-center gap-2 border px-4 py-2 font-mono text-[11px] uppercase leading-none tracking-[0.2em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
