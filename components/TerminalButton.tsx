"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "ghost" | "primary" | "danger" | "success";

/**
 * Flat variants only: a colour is either fully on (solid fill / border) or
 * off (panel background). Hover inverts to a solid fill, never a tint.
 */
const VARIANTS: Record<Variant, string> = {
  // the accent colour is the hover state: quiet grey -> solid cyan
  ghost:
    "border-dim text-ink hover:border-primary hover:bg-primary hover:text-space",
  primary:
    "border-primary bg-primary text-space hover:shadow-[0_0_24px_rgba(34,211,238,0.35)]",
  danger: "border-danger text-danger hover:bg-danger hover:text-space",
  success: "border-success text-success hover:bg-success hover:text-space",
};

/** Square, 1px bordered, uppercase, letter-spaced terminal button. */
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
      className={`inline-flex cursor-pointer touch-manipulation items-center justify-center gap-2 border px-4 py-2 text-[11px] uppercase tracking-[0.25em] transition-[background-color,box-shadow,color] duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
