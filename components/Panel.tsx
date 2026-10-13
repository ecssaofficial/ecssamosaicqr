import type { ReactNode } from "react";

/** Square terminal panel: 1px cyan border, flat panel background. */
export default function Panel({
  label,
  headerRight,
  children,
  className = "",
  bodyClassName = "",
}: {
  label?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`border border-dim bg-panel ${className}`}>
      {label ? (
        <header className="flex items-center justify-between gap-3 border-b border-dim px-3 py-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-dim">
            {label}
          </span>
          {headerRight ? (
            <span className="text-[10px] uppercase tracking-[0.3em] text-dim">
              {headerRight}
            </span>
          ) : null}
        </header>
      ) : null}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
