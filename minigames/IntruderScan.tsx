"use client";

import { useEffect, useRef, useState } from "react";
import TerminalButton from "@/components/TerminalButton";

/**
 * QR 02 — INTRUDER SCAN (logic and level ported from
 * `project-hail-mary-games/game1-intruder.html`).
 *
 * One fixed level: five identical objects and one anomaly. Every object
 * carries the same five properties except object D, whose core dot sits
 * top-right instead of dead centre. Only the six display positions are
 * shuffled per session, which never changes the answer — the odd object is
 * read off its own properties.
 */

type Dot = "center" | "tl" | "tr" | "bl" | "br";
type BorderKind = "solid" | "dashed" | "dotted" | "double";
type Core = "diamond" | "square" | "cross";

type Params = {
  spikes: number;
  dot: Dot;
  border: BorderKind;
  core: Core;
  tilt: number;
};

/**
 * Each level deals nine objects: eight are byte-for-byte identical and one
 * deviates in exactly one property. `tilt` is randomised but never the
 * deviating property — a tilt-only change is invisible on a symmetric glyph,
 * so every level is guaranteed to have a findable intruder.
 */
const IDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
const LEVELS = 3;

const SPIKES = [6, 8, 12];
const DOTS: Dot[] = ["center", "tl", "tr", "bl", "br"];
const BORDERS: BorderKind[] = ["solid", "dashed", "dotted", "double"];
const CORES: Core[] = ["diamond", "square", "cross"];
const TILTS = [0, 90, 180, 270];
const DEVIATIONS = ["spikes", "dot", "border", "core"] as const;

const DOT_OFFSET = 9;
const DOT_POS: Record<Dot, [number, number]> = {
  center: [0, 0],
  tl: [-DOT_OFFSET, -DOT_OFFSET],
  tr: [DOT_OFFSET, -DOT_OFFSET],
  bl: [-DOT_OFFSET, DOT_OFFSET],
  br: [DOT_OFFSET, DOT_OFFSET],
};

function shuffle(input: readonly string[]): string[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Level = { base: Params; odd: Params; oddId: string; order: string[] };

function pick<T>(input: readonly T[]): T {
  return input[Math.floor(Math.random() * input.length)];
}

/** Nine objects: eight identical, one deviating in exactly one property. */
function dealLevel(): Level {
  const base: Params = {
    spikes: pick(SPIKES),
    dot: pick(DOTS),
    border: pick(BORDERS),
    core: pick(CORES),
    tilt: pick(TILTS),
  };
  const odd: Params = { ...base };

  switch (pick(DEVIATIONS)) {
    case "spikes":
      odd.spikes = pick(SPIKES.filter((s) => s !== base.spikes));
      break;
    case "dot":
      odd.dot = pick(DOTS.filter((d) => d !== base.dot));
      break;
    case "border":
      odd.border = pick(BORDERS.filter((b) => b !== base.border));
      break;
    case "core":
      odd.core = pick(CORES.filter((c) => c !== base.core));
      break;
  }

  return { base, odd, oddId: pick(IDS), order: shuffle(IDS) };
}

/** One scanned object, drawn entirely in currentColor so it takes the cell's tone. */
function Glyph({ params }: { params: Params }) {
  const spikes = Array.from({ length: params.spikes }, (_, i) => (
    <polygon
      key={i}
      points="-4.5,-40 0,-50 4.5,-40"
      transform={`rotate(${((i * 360) / params.spikes).toFixed(2)})`}
      fill="currentColor"
    />
  ));

  let border: React.ReactNode = null;
  if (params.border === "solid") {
    border = <circle r={40} fill="none" stroke="currentColor" strokeWidth={3} />;
  } else if (params.border === "dashed") {
    border = (
      <circle
        r={40}
        fill="none"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeDasharray="15 9"
      />
    );
  } else if (params.border === "dotted") {
    border = (
      <circle
        r={40}
        fill="none"
        stroke="currentColor"
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeDasharray="0.1 8.4"
      />
    );
  } else {
    border = (
      <>
        <circle r={40} fill="none" stroke="currentColor" strokeWidth={2.2} />
        <circle r={34.5} fill="none" stroke="currentColor" strokeWidth={2.2} />
      </>
    );
  }

  let core: React.ReactNode;
  if (params.core === "square") {
    core = (
      <rect
        x={-14}
        y={-14}
        width={28}
        height={28}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
      />
    );
  } else if (params.core === "cross") {
    core = (
      <path
        d="M-17 0H17M0 -17V17"
        stroke="currentColor"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />
    );
  } else {
    core = (
      <polygon
        points="0,-18 18,0 0,18 -18,0"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
      />
    );
  }

  const [dx, dy] = DOT_POS[params.dot];

  return (
    <svg viewBox="-54 -54 108 108" aria-hidden className="h-full w-full">
      <g transform={`rotate(${params.tilt})`}>
        <g>
          {spikes}
          {border}
        </g>
        <polygon points="0,-31 -5.5,-23 5.5,-23" fill="currentColor" />
        {core}
        <circle cx={dx} cy={dy} r={5} fill="currentColor" />
      </g>
    </svg>
  );
}

export default function IntruderScan({ onWin }: { onWin: () => void }) {
  const [level, setLevel] = useState<number>(0);
  const [deal, setDeal] = useState<Level>(() => dealLevel());
  const [selected, setSelected] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState("SELECT AN OBJECT TO SCAN.");
  const timers = useRef<number[]>([]);
  const declared = useRef(false);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function confirm() {
    if (solved) return;
    if (!selected) {
      setStatus("SELECT AN OBJECT BEFORE CONFIRMING.");
      return;
    }

    if (selected !== deal.oddId) {
      setFailed(true);
      setSelected(null);
      setStatus("SCAN INCONCLUSIVE — TRY AGAIN");
      later(() => setFailed(false), 200);
      return;
    }

    // Correct: flash the reveal, then either the next scan or the win.
    setSolved(true);
    setSelected(null);
    setStatus("ANOMALY IDENTIFIED");

    later(() => {
      if (declared.current) return;
      if (level + 1 >= LEVELS) {
        declared.current = true;
        onWin();
        return;
      }
      setLevel((n) => n + 1);
      setDeal(dealLevel());
      setSolved(false);
      setStatus("SELECT AN OBJECT TO SCAN.");
    }, 700);
  }

  function reset() {
    if (solved) return;
    setDeal(dealLevel());
    setSelected(null);
    setStatus("SELECT AN OBJECT TO SCAN.");
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
          {solved ? "ANOMALY ISOLATED" : "TAP THE ANOMALY, THEN CONFIRM"}
        </p>
        <TerminalButton
          className="px-2 py-1 text-[9px]"
          onClick={reset}
          disabled={solved}
        >
          RESET
        </TerminalButton>
      </div>

      <div className="flex gap-1">
        {Array.from({ length: LEVELS }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 transition-colors duration-150 ${
              i < level || solved ? "bg-ink" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <div
        className={`grid grid-cols-3 gap-2 border p-2 transition-colors duration-150 ${
          failed ? "border-danger" : "border-white/15"
        }`}
      >
        {deal.order.map((id) => {
          const isOdd = id === deal.oddId;
          const tone = solved
            ? isOdd
              ? "border-ink bg-ink text-space"
              : "border-white/10 bg-space text-white/15"
            : selected === id
              ? "border-ink bg-space text-ink"
              : "border-white/10 bg-space text-white/55 hover:border-white/40 hover:text-ink";
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (solved) return;
                setSelected((prev) => (prev === id ? null : id));
              }}
              disabled={solved}
              aria-label={`object ${id}`}
              aria-pressed={selected === id}
              className={`aspect-square touch-manipulation border p-2 transition-colors duration-150 disabled:cursor-default sm:p-3 ${tone}`}
            >
              <Glyph params={isOdd ? deal.odd : deal.base} />
            </button>
          );
        })}
      </div>

      <p
        aria-live="polite"
        className={`min-h-[14px] text-center font-mono text-[10px] uppercase tracking-[0.25em] ${
          solved ? "text-ink" : failed ? "text-danger" : "text-white/45"
        }`}
      >
        {status}
      </p>

      <TerminalButton
        variant="primary"
        className="w-full py-3"
        onClick={confirm}
        disabled={solved || !selected}
      >
        CONFIRM ANOMALY
      </TerminalButton>

      <p className="text-center font-mono text-[9px] uppercase tracking-[0.3em] text-white/25">
        SCAN {String(level + 1).padStart(2, "0")} / {String(LEVELS).padStart(2, "0")}
      </p>
    </div>
  );
}
