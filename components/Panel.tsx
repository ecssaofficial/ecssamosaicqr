import type { ReactNode } from "react";

/**
 * Instrument faceplate: black surface, hairline border, generous padding,
 * section label sitting on a hairline rule (technical-manual style) and
 * 8px registration marks at the corners of major panels.
 */
export default function Panel({
  label,
  headerRight,
  children,
  className = "",
  bodyClassName = "",
  marks = true,
  flush = false,
}: {
  label?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  marks?: boolean;
  /** When true, the panel is an inner faceplate with no border or corner marks. */
  flush?: boolean;
}) {
  const corner =
    "pointer-events-none absolute h-2 w-2 border-white/25 opacity-100";

  const faceplate = flush
    ? "relative bg-panel"
    : "relative border border-white/15 bg-panel";

  return (
    // Square corners: every radius utility resolves to 0 in tailwind.config.ts.
    <section className={`${faceplate} ${className}`}>
      {marks && !flush ? (
        <span aria-hidden className={`${corner} left-0 top-0 border-l border-t`} />
      ) : null}
      {marks && !flush ? (
        <span aria-hidden className={`${corner} right-0 top-0 border-r border-t`} />
      ) : null}
      {marks && !flush ? (
        <span
          aria-hidden
          className={`${corner} bottom-0 left-0 border-b border-l`}
        />
      ) : null}
      {marks && !flush ? (
        <span
          aria-hidden
          className={`${corner} bottom-0 right-0 border-b border-r`}
        />
      ) : null}

      {label ? (
        <header className="flex items-center gap-3 px-5 pb-2 pt-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
            {label}
          </span>
          <span aria-hidden className="h-px flex-1 bg-white/10" />
          {headerRight ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
              {headerRight}
            </span>
          ) : null}
        </header>
      ) : null}
      <div className={`px-5 pb-5 ${label ? "pt-3" : "pt-5"} ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}
