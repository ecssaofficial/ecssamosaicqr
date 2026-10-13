"use client";

import { useEffect, useRef, useState } from "react";
import TerminalButton from "@/components/TerminalButton";

/**
 * QR 08 — CIRCUIT REPAIR (logic and level ported from
 * `project-hail-mary-games/game4-circuit.html`).
 *
 * One fixed 3×3 board: nine wires, five of them on the power run from the
 * SOURCE node to the RECEIVER node and four decoys. Tile shapes and the
 * starting rotations are hard-coded, so the layout never changes and the
 * board is never solved at the first test.
 *
 * A wire only conducts when two neighbouring tiles both expose an opening
 * toward each other, so TEST traces a breadth-first search over matching
 * openings from the source.
 */

const CFG: {
  path: number[][];
  sourceSide: string;
  receiverSide: string;
  decoyTypes: string[];
  initRots: number[];
} = {
  path: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [2, 2],
  ],
  sourceSide: "left",
  receiverSide: "right",
  decoyTypes: ["corner", "straight", "straight", "corner"],
  initRots: [0, 1, 0, 0, 1, 0, 0, 1, 0],
};

const DIRS = [
  { dr: -1, dc: 0 },
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
];
const SIDE: Record<string, number> = { top: 0, right: 1, bottom: 2, left: 3 };
const SIDE_WORD = ["up", "right", "down", "left"];

const CELL = 100;
const HALF = 50;

type WireType = "straight" | "corner";

function openings(type: WireType, rot: number): number[] {
  const base = type === "straight" ? [0, 2] : [0, 1];
  return base.map((d) => (d + rot) % 4);
}

function dirBetween(a: number[], b: number[]): number {
  return DIRS.findIndex(
    (d) => d.dr === b[0] - a[0] && d.dc === b[1] - a[1],
  );
}

function pad3(v: number): string {
  return v.toString().padStart(3, "0");
}

/** Correct type + rotation for every tile on the intended power run. */
function solvedSpec() {
  const sourceDir = SIDE[CFG.sourceSide];
  const receiverDir = SIDE[CFG.receiverSide];
  const spec: Record<number, { type: WireType; rot: number }> = {};

  CFG.path.forEach((cell, i) => {
    const inDir =
      i === 0 ? sourceDir : dirBetween(cell, CFG.path[i - 1]);
    const outDir =
      i === CFG.path.length - 1
        ? receiverDir
        : dirBetween(cell, CFG.path[i + 1]);
    const type: WireType =
      (inDir + 2) % 4 === outDir ? "straight" : "corner";
    let rot = 0;
    for (; rot < 4; rot += 1) {
      const o = openings(type, rot);
      if (o.includes(inDir) && o.includes(outDir)) break;
    }
    spec[cell[0] * 3 + cell[1]] = { type, rot };
  });

  return spec;
}

/** Deterministic tile shapes: path tiles from the run, decoys in reading order. */
function buildTypes(): WireType[] {
  const spec = solvedSpec();
  const decoys = [...CFG.decoyTypes];
  const types: WireType[] = [];
  let di = 0;
  for (let i = 0; i < 9; i += 1) {
    if (spec[i]) {
      types[i] = spec[i].type;
    } else {
      const t = decoys.length ? decoys[di % decoys.length] : di % 2 ? "straight" : "corner";
      di += 1;
      types[i] = t === "straight" ? "straight" : "corner";
    }
  }
  return types;
}

type Trace = { connected: boolean; order: number[]; reached: number[] };

/** Breadth-first search over matching openings only. */
function trace(types: WireType[], rots: number[]): Trace {
  const sourceDir = SIDE[CFG.sourceSide];
  const receiverDir = SIDE[CFG.receiverSide];
  const first = CFG.path[0];
  const last = CFG.path[CFG.path.length - 1];
  const startIdx = first[0] * 3 + first[1];
  const endIdx = last[0] * 3 + last[1];
  const has = (i: number, d: number) => openings(types[i], rots[i]).includes(d);

  const reached = new Set<number>();
  if (!has(startIdx, sourceDir)) {
    return { connected: false, order: [], reached: [...reached] };
  }

  const parent: Record<number, number> = { [startIdx]: -1 };
  const queue = [startIdx];
  reached.add(startIdx);

  while (queue.length) {
    const cur = queue.shift() as number;
    if (cur === endIdx && has(cur, receiverDir)) {
      const order: number[] = [];
      for (let n = cur; n !== -1; n = parent[n]) order.unshift(n);
      return { connected: true, order, reached: [...reached] };
    }
    const cr = Math.floor(cur / 3);
    const cc = cur % 3;
    for (let d = 0; d < 4; d += 1) {
      if (!has(cur, d)) continue;
      const nr = cr + DIRS[d].dr;
      const nc = cc + DIRS[d].dc;
      if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
      const ni = nr * 3 + nc;
      if (reached.has(ni) || !has(ni, (d + 2) % 4)) continue;
      reached.add(ni);
      parent[ni] = cur;
      queue.push(ni);
    }
  }

  return { connected: false, order: [], reached: [...reached] };
}

const TYPES = buildTypes();

/** Straight runs top-to-bottom at zero rotation, corners bend top-to-right. */
function wirePath(type: WireType): string {
  return type === "straight" ? "M0 -50 L0 50" : "M0 -50 Q0 0 50 0";
}

type Tone = "idle" | "danger" | "ok";

export default function CircuitGrid({ onWin }: { onWin: () => void }) {
  const [rots, setRots] = useState<number[]>(() => [...CFG.initRots]);
  const [warned, setWarned] = useState<Set<number>>(() => new Set<number>());
  const [powered, setPowered] = useState<Set<number>>(() => new Set<number>());
  const [solved, setSolved] = useState(false);
  const [tone, setTone] = useState<Tone>("idle");
  const [status, setStatus] = useState("ROTATE THE WIRES, THEN TEST");
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

  function rotate(i: number) {
    if (solved) return;
    setRots((prev) => prev.map((r, idx) => (idx === i ? (r + 1) % 4 : r)));
    if (warned.size) setWarned(new Set<number>());
    if (tone !== "idle") {
      setTone("idle");
      setStatus("ROTATE THE WIRES, THEN TEST");
    }
  }

  function reset() {
    if (solved) return;
    setRots([...CFG.initRots]);
    setWarned(new Set<number>());
    setTone("idle");
    setStatus("CIRCUIT RESET TO STARTING LAYOUT.");
  }

  function test() {
    if (solved) return;
    const result = trace(TYPES, rots);

    if (!result.connected) {
      setWarned(new Set(result.reached));
      setTone("danger");
      setStatus(
        result.reached.length <= 1
          ? "SOURCE LINK FAILED — ALIGN THE FIRST TILE"
          : "CONNECTION BROKEN — CHECK THE GLOWING TILES",
      );
      later(() => setTone("idle"), 400);
      return;
    }

    setPowered(new Set(result.order));
    setWarned(new Set<number>());
    setSolved(true);
    setTone("ok");
    setStatus("POWER RESTORED");
    later(() => {
      if (declared.current) return;
      declared.current = true;
      onWin();
    }, 450);
  }

  const sourceDir = SIDE[CFG.sourceSide];
  const receiverDir = SIDE[CFG.receiverSide];
  const firstCell = CFG.path[0];
  const lastCell = CFG.path[CFG.path.length - 1];

  const node = (cell: number[], d: number, dist: number): [number, number] => [
    cell[1] * CELL + HALF + DIRS[d].dc * dist,
    cell[0] * CELL + HALF + DIRS[d].dr * dist,
  ];

  const srcEdge = node(firstCell, sourceDir, HALF);
  const srcNode = node(firstCell, sourceDir, HALF * 2);
  const rcvEdge = node(lastCell, receiverDir, HALF);
  const rcvNode = node(lastCell, receiverDir, HALF * 2);

  const toneClass =
    tone === "danger" ? "text-danger" : tone === "ok" ? "text-ink" : "text-white/45";

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
          {solved ? "POWER RUN CLOSED" : "TAP A TILE TO ROTATE IT"}
        </p>
        <TerminalButton
          className="px-2 py-1 text-[9px]"
          onClick={reset}
          disabled={solved}
        >
          RESET
        </TerminalButton>
      </div>

      <div
        className={`border bg-space p-2 transition-colors duration-150 ${
          tone === "danger" ? "border-danger" : "border-white/15"
        }`}
      >
        <svg
          viewBox={`${-HALF * 2} -8 ${CELL * 3 + HALF * 4} ${CELL * 3 + 16}`}
          className="w-full"
          role="group"
          aria-label="Energy circuit, three by three"
        >
          <rect
            x={-6}
            y={-6}
            width={CELL * 3 + 12}
            height={CELL * 3 + 12}
            className="fill-none stroke-white/15"
            strokeWidth={2}
          />

          <line
            x1={srcEdge[0]}
            y1={srcEdge[1]}
            x2={srcNode[0]}
            y2={srcNode[1]}
            className="stroke-white/25"
            strokeWidth={3}
          />
          <line
            x1={rcvEdge[0]}
            y1={rcvEdge[1]}
            x2={rcvNode[0]}
            y2={rcvNode[1]}
            className="stroke-white/25"
            strokeWidth={3}
          />

          {TYPES.map((type, i) => {
            const cx = (i % 3) * CELL + HALF;
            const cy = Math.floor(i / 3) * CELL + HALF;
            const wire = powered.has(i)
              ? "text-ink"
              : warned.has(i)
                ? "text-danger"
                : "text-white/45";
            const openWords = openings(type, rots[i])
              .map((d) => SIDE_WORD[d])
              .join(" and ");
            return (
              <g key={i} transform={`translate(${cx} ${cy})`}>
                <rect
                  x={-48}
                  y={-48}
                  width={96}
                  height={96}
                  className="fill-none stroke-white/10"
                />
                <g
                  style={{
                    transform: `rotate(${rots[i] * 90}deg)`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    transition: "transform 150ms linear",
                  }}
                >
                  {/* Invisible full-tile square: keeps the rotation origin at
                      the cell centre for the asymmetric corner wire. */}
                  <rect x={-50} y={-50} width={100} height={100} fill="none" stroke="none" />
                  <path
                    d={wirePath(type)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={5}
                    strokeLinecap="square"
                    className={wire}
                  />
                </g>
                <rect
                  x={-50}
                  y={-50}
                  width={100}
                  height={100}
                  className="cursor-pointer fill-none stroke-transparent hover:stroke-white/40"
                  role="button"
                  tabIndex={solved ? -1 : 0}
                  aria-label={`Tile ${pad3(i)} — ${type} wire open ${openWords}. Tap to rotate clockwise.`}
                  onClick={() => rotate(i)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    rotate(i);
                  }}
                />
              </g>
            );
          })}

          <g transform={`translate(${srcNode[0]} ${srcNode[1]})`}>
            <rect
              x={-30}
              y={-30}
              width={60}
              height={60}
              className="fill-none stroke-ink"
              strokeWidth={3}
            />
            <polygon
              points="4,-24 -13,4 -1,4 -5,24 13,-5 1,-5"
              className="fill-ink"
            />
            <text
              x={0}
              y={-45}
              textAnchor="middle"
              className="font-mono"
              fontSize={13}
              letterSpacing="2"
              fill="currentColor"
              fillOpacity={0.45}
            >
              SOURCE
            </text>
          </g>

          <g transform={`translate(${rcvNode[0]} ${rcvNode[1]})`}>
            <rect
              x={-30}
              y={-30}
              width={60}
              height={60}
              className={powered.size ? "fill-ink stroke-ink" : "fill-none stroke-ink"}
              strokeWidth={3}
            />
            <path
              d="M-16 0h32M0 -16v32"
              stroke={powered.size ? "#000000" : "currentColor"}
              strokeWidth={3.5}
              className="fill-none"
            />
            <text
              x={0}
              y={-45}
              textAnchor="middle"
              className="font-mono"
              fontSize={13}
              letterSpacing="2"
              fill="currentColor"
              fillOpacity={0.45}
            >
              RECEIVER
            </text>
          </g>
        </svg>
      </div>

      <p
        aria-live="polite"
        className={`min-h-[14px] text-center font-mono text-[10px] uppercase tracking-[0.25em] ${toneClass}`}
      >
        {status}
      </p>

      <TerminalButton
        variant="primary"
        className="w-full py-3"
        onClick={test}
        disabled={solved}
      >
        {solved ? "POWER RESTORED" : "TEST CIRCUIT"}
      </TerminalButton>
    </div>
  );
}
