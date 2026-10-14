"use client";

import { useEffect, useRef, useState } from "react";
import TerminalButton from "@/components/TerminalButton";

/**
 * QR 08 — CIRCUIT REPAIR.
 *
 * Board geometry ported from `project-hail-mary-games/game4-circuit.html`,
 * with the single hard-coded layout replaced by a level generator.
 *
 * Each level deals a fresh 3×3 board:
 *   - a random source side and receiver side,
 *   - a random non-self-intersecting power run between them,
 *   - random tile shapes, and
 *   - starting rotations chosen so every tile on the run starts off its
 *     solved angle.
 *
 * The deal is only accepted after a breadth-first trace confirms the starting
 * layout does NOT conduct — so no board is ever already solved — while the
 * solved angles always do, so every board is solvable.
 */

const DIRS = [
  { dr: -1, dc: 0 },
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
];
const SIDE: Record<string, number> = { top: 0, right: 1, bottom: 2, left: 3 };
const SIDES = ["top", "right", "bottom", "left"];
const SIDE_WORD = ["up", "right", "down", "left"];
const WIRE_TYPES: WireType[] = ["straight", "corner"];

const CELL = 100;
const HALF = 50;
const MARGIN = 130;
const LEVELS = 3;

type WireType = "straight" | "corner";

type Circuit = {
  path: number[][];
  sourceSide: string;
  receiverSide: string;
  initRots: number[];
  types: WireType[];
};

/** Two openings per wire, rotated clockwise in quarter turns. */
function openings(type: WireType, rot: number): number[] {
  const base = type === "straight" ? [0, 2] : [0, 1];
  return base.map((d) => (d + rot) % 4);
}

function dirBetween(a: number[], b: number[]): number {
  return DIRS.findIndex((d) => d.dr === b[0] - a[0] && d.dc === b[1] - a[1]);
}

function shuffle<T>(input: readonly T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pick<T>(input: readonly T[]): T {
  return input[Math.floor(Math.random() * input.length)];
}

function pad3(v: number): string {
  return v.toString().padStart(3, "0");
}

/** Cells sitting on the edge a side faces. */
function edgeCells(side: string): number[][] {
  const d = SIDE[side];
  const cells: number[][] = [];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const onEdge =
        (d === 0 && r === 0) ||
        (d === 2 && r === 2) ||
        (d === 1 && c === 2) ||
        (d === 3 && c === 0);
      if (onEdge) cells.push([r, c]);
    }
  }
  return cells;
}

/** Random self-avoiding walk from start to end, 4–7 tiles long. */
function randomPath(start: number[], end: number[]): number[][] | null {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const path = [start];
    const visited = new Set([start.join(",")]);
    if (walk(path, visited, end) && path.length >= 4 && path.length <= 7) {
      return path;
    }
  }
  return null;
}

function walk(
  path: number[][],
  visited: Set<string>,
  end: number[],
): boolean {
  const cur = path[path.length - 1];
  if (cur[0] === end[0] && cur[1] === end[1]) return true;

  const next = shuffle(
    DIRS.map((d) => [cur[0] + d.dr, cur[1] + d.dc]).filter(
      ([r, c]) =>
        r >= 0 && r < 3 && c >= 0 && c < 3 && !visited.has(`${r},${c}`),
    ),
  );

  for (const n of next) {
    visited.add(n.join(","));
    path.push(n);
    if (walk(path, visited, end)) return true;
    path.pop();
    visited.delete(n.join(","));
  }
  return false;
}

type Spec = { type: WireType; rot: number; inDir: number; outDir: number };

/** Correct type + rotation for every tile on the intended power run. */
function specFor(c: Pick<Circuit, "path" | "sourceSide" | "receiverSide">) {
  const sourceDir = SIDE[c.sourceSide];
  const receiverDir = SIDE[c.receiverSide];
  const spec: Record<number, Spec> = {};

  c.path.forEach((cell, i) => {
    const inDir = i === 0 ? sourceDir : dirBetween(cell, c.path[i - 1]);
    const outDir =
      i === c.path.length - 1 ? receiverDir : dirBetween(cell, c.path[i + 1]);
    const type: WireType =
      (inDir + 2) % 4 === outDir ? "straight" : "corner";
    let rot = 0;
    for (; rot < 4; rot += 1) {
      const o = openings(type, rot);
      if (o.includes(inDir) && o.includes(outDir)) break;
    }
    spec[cell[0] * 3 + cell[1]] = { type, rot, inDir, outDir };
  });

  return spec;
}

/** Breadth-first search over matching openings only. */
function trace(types: WireType[], rots: number[], c: Circuit) {
  const sourceDir = SIDE[c.sourceSide];
  const receiverDir = SIDE[c.receiverSide];
  const first = c.path[0];
  const last = c.path[c.path.length - 1];
  const startIdx = first[0] * 3 + first[1];
  const endIdx = last[0] * 3 + last[1];
  const has = (i: number, d: number) =>
    openings(types[i], rots[i]).includes(d);

  const reached = new Set<number>();
  if (!has(startIdx, sourceDir)) {
    return { connected: false, order: [] as number[], reached: [...reached] };
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

  return { connected: false, order: [] as number[], reached: [...reached] };
}

/**
 * Deal one board. Accepted only when the starting rotations do not conduct,
 * which keeps every level unsolved at the start and solvable by construction.
 */
function dealLevel(): Circuit {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const sourceSide = pick(SIDES);
    const receiverSide = pick(SIDES.filter((s) => s !== sourceSide));
    const start = pick(edgeCells(sourceSide));
    const end = pick(edgeCells(receiverSide));
    if (start[0] === end[0] && start[1] === end[1]) continue;

    const path = randomPath(start, end);
    if (!path) continue;

    const spec = specFor({ path, sourceSide, receiverSide });
    const types: WireType[] = [];
    for (let i = 0; i < 9; i += 1) {
      types[i] = spec[i] ? spec[i].type : pick(WIRE_TYPES);
    }

    const initRots = types.map((type, i) => {
      if (!spec[i]) return Math.floor(Math.random() * 4);
      const { inDir, outDir } = spec[i];
      const wrong = [0, 1, 2, 3].filter((r) => {
        const o = openings(type, r);
        return !(o.includes(inDir) && o.includes(outDir));
      });
      return wrong.length ? pick(wrong) : spec[i].rot;
    });

    const circuit: Circuit = {
      path,
      sourceSide,
      receiverSide,
      initRots,
      types,
    };
    if (!trace(types, initRots, circuit).connected) return circuit;
  }

  // Unreachable in practice — fall back to the original published layout.
  return {
    path: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    sourceSide: "left",
    receiverSide: "right",
    initRots: [0, 1, 0, 0, 1, 0, 0, 1, 0],
    types: [
      "straight",
      "corner",
      "corner",
      "straight",
      "straight",
      "straight",
      "corner",
      "corner",
      "straight",
    ],
  };
}

/** Straight runs top-to-bottom at zero rotation, corners bend top-to-right. */
function wirePath(type: WireType): string {
  return type === "straight" ? "M0 -50 L0 50" : "M0 -50 Q0 0 50 0";
}

type Tone = "idle" | "danger" | "ok";

export default function CircuitGrid({ onWin }: { onWin: () => void }) {
  const [level, setLevel] = useState(0);
  const [circuit, setCircuit] = useState<Circuit>(() => dealLevel());
  const [rots, setRots] = useState<number[]>(() => [...circuit.initRots]);
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
    setRots([...circuit.initRots]);
    setWarned(new Set<number>());
    setTone("idle");
    setStatus("CIRCUIT RESET TO STARTING LAYOUT.");
  }

  function test() {
    if (solved) return;
    const result = trace(circuit.types, rots, circuit);

    if (!result.connected) {
      setWarned(new Set(result.reached));
      setTone("danger");
      setStatus(
        result.reached.length <= 1
          ? "SOURCE LINK FAILED — ALIGN THE FIRST TILE"
          : "CONNECTION BROKEN — CHECK THE GLOWING TILES",
      );
      later(() => setTone("idle"), 500);
      return;
    }

    // Power restored: light the run, then the next board or the win.
    setPowered(new Set(result.order));
    setWarned(new Set<number>());
    setSolved(true);
    setTone("ok");
    setStatus("POWER RESTORED");

    later(() => {
      if (declared.current) return;
      if (level + 1 >= LEVELS) {
        declared.current = true;
        onWin();
        return;
      }
      const next = dealLevel();
      setLevel((n) => n + 1);
      setCircuit(next);
      setRots([...next.initRots]);
      setPowered(new Set<number>());
      setSolved(false);
      setTone("idle");
      setStatus("ROTATE THE WIRES, THEN TEST");
    }, 700);
  }

  const sourceDir = SIDE[circuit.sourceSide];
  const receiverDir = SIDE[circuit.receiverSide];
  const firstCell = circuit.path[0];
  const lastCell = circuit.path[circuit.path.length - 1];

  const nodeFor = (cell: number[], d: number, dist: number): [number, number] => [
    cell[1] * CELL + HALF + DIRS[d].dc * dist,
    cell[0] * CELL + HALF + DIRS[d].dr * dist,
  ];

  const srcEdge = nodeFor(firstCell, sourceDir, HALF);
  const srcNode = nodeFor(firstCell, sourceDir, HALF * 2);
  const rcvEdge = nodeFor(lastCell, receiverDir, HALF);
  const rcvNode = nodeFor(lastCell, receiverDir, HALF * 2);
  const labelFor = (cell: number[], d: number): [number, number] => [
    nodeFor(cell, d, HALF * 2)[0] + DIRS[d].dc * 45,
    nodeFor(cell, d, HALF * 2)[1] + DIRS[d].dr * 45,
  ];
  const srcLabel = labelFor(firstCell, sourceDir);
  const rcvLabel = labelFor(lastCell, receiverDir);

  const margin = (d: number) =>
    sourceDir === d || receiverDir === d ? MARGIN : 8;
  const viewBox = `${-margin(3)} ${-margin(0)} ${CELL * 3 + margin(3) + margin(1)} ${CELL * 3 + margin(0) + margin(2)}`;

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
        className={`border bg-space p-2 transition-colors duration-150 ${
          tone === "danger" ? "border-danger" : "border-white/15"
        }`}
      >
        <svg viewBox={viewBox} className="w-full" role="group" aria-label="Energy circuit, three by three">
          <rect
            x={-6}
            y={-6}
            width={CELL * 3 + 12}
            height={CELL * 3 + 12}
            className="fill-none stroke-white/15"
            strokeWidth={2}
          />

          <line x1={srcEdge[0]} y1={srcEdge[1]} x2={srcNode[0]} y2={srcNode[1]} className="stroke-white/25" strokeWidth={3} />
          <line x1={rcvEdge[0]} y1={rcvEdge[1]} x2={rcvNode[0]} y2={rcvNode[1]} className="stroke-white/25" strokeWidth={3} />

          {circuit.types.map((type, i) => {
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
                <rect x={-48} y={-48} width={96} height={96} className="fill-none stroke-white/10" />
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
                {/* Hit target. `pointer-events="all"` is what makes the whole
                    100×100 cell tappable: with fill:none the interior would
                    otherwise be dead and only the hairline border clickable. */}
                <rect
                  x={-50}
                  y={-50}
                  width={100}
                  height={100}
                  pointerEvents="all"
                  className="cursor-pointer touch-manipulation fill-none stroke-transparent hover:stroke-white/40"
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
            <rect x={-30} y={-30} width={60} height={60} className="fill-none stroke-ink" strokeWidth={3} />
            <polygon points="4,-24 -13,4 -1,4 -5,24 13,-5 1,-5" className="fill-ink" />
            <text
              x={srcLabel[0] - srcNode[0]}
              y={srcLabel[1] - srcNode[1]}
              textAnchor="middle"
              dominantBaseline="middle"
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
              x={rcvLabel[0] - rcvNode[0]}
              y={rcvLabel[1] - rcvNode[1]}
              textAnchor="middle"
              dominantBaseline="middle"
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

      <p aria-live="polite" className={`min-h-[14px] text-center font-mono text-[10px] uppercase tracking-[0.25em] ${toneClass}`}>
        {status}
      </p>

      <TerminalButton variant="primary" className="w-full py-3" onClick={test} disabled={solved}>
        {solved ? "POWER RESTORED" : "TEST CIRCUIT"}
      </TerminalButton>

      <p className="text-center font-mono text-[9px] uppercase tracking-[0.3em] text-white/25">
        BOARD {String(level + 1).padStart(2, "0")} / {String(LEVELS).padStart(2, "0")}
      </p>
    </div>
  );
}
