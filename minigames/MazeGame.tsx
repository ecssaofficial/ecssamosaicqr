"use client";

import { useEffect, useRef, useState } from "react";
import TerminalButton from "@/components/TerminalButton";

/**
 * Hand-authored 10x10 layouts (# wall, . open, S start, G goal).
 * The layout is chosen deterministically from the QR id, so QR 08 is
 * always the same maze.
 */
const MAZES: string[][] = [
  [
    "S#...#...#",
    ".#.#.#.#.#",
    ".#.#...#.#",
    ".#####.#.#",
    ".....#.#.#",
    "####.###.#",
    ".#...#...#",
    ".#.###.#.#",
    ".......#G#",
    "##########",
  ],
  [
    "S..#.....#",
    "##.###.#.#",
    ".#...#.#.#",
    ".###.#.#.#",
    "...#...#.#",
    ".#.#####.#",
    ".#.#.....#",
    ".###.#####",
    "........G#",
    "##########",
  ],
  [
    "S#.......#",
    ".#####.#.#",
    "...#...#.#",
    "##.#.###.#",
    ".#...#.#.#",
    ".#####.#.#",
    ".....#...#",
    ".#.###.###",
    ".#......G#",
    "##########",
  ],
];

const DIRECTIONS: Record<string, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

type Cell = { row: number; col: number };

export default function MazeGame({
  onWin,
  qrId = 8,
}: {
  onWin: () => void;
  qrId?: number;
}) {
  const layout = MAZES[qrId % MAZES.length];

  const find = (char: string): Cell => {
    for (let row = 0; row < layout.length; row += 1) {
      const col = layout[row].indexOf(char);
      if (col !== -1) return { row, col };
    }
    return { row: 0, col: 0 };
  };

  const start = find("S");
  const goal = find("G");

  const [pos, setPos] = useState<Cell>(start);
  const declared = useRef(false);

  const atGoal = pos.row === goal.row && pos.col === goal.col;

  useEffect(() => {
    if (atGoal && !declared.current) {
      declared.current = true;
      onWin();
    }
  }, [atGoal, onWin]);

  const open = (row: number, col: number) =>
    row >= 0 &&
    row < layout.length &&
    col >= 0 &&
    col < layout[0].length &&
    layout[row][col] !== "#";

  function step(dr: number, dc: number) {
    setPos((current) => {
      const row = current.row + dr;
      const col = current.col + dc;
      return open(row, col) ? { row, col } : current;
    });
  }

  function tapCell(row: number, col: number) {
    const distance = Math.abs(row - pos.row) + Math.abs(col - pos.col);
    if (distance !== 1 || !open(row, col)) return;
    setPos({ row, col });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.25em] text-dim">
          REACH THE GREEN CELL
        </p>
        <TerminalButton
          className="px-2 py-1 text-[9px]"
          onClick={() => setPos(start)}
        >
          RESET
        </TerminalButton>
      </div>

      <div className="grid aspect-square w-full grid-cols-10 grid-rows-10 gap-[2px]">
        {layout.map((line, row) =>
          [...line].map((char, col) => {
            const isWall = char === "#";
            const isGoal = row === goal.row && col === goal.col;
            const isPlayer = row === pos.row && col === pos.col;
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                onClick={() => tapCell(row, col)}
                aria-label={isWall ? "wall" : `cell ${row} ${col}`}
                // flat blocks: wall = panel block, open = space block,
                // goal = solid green, player = solid cyan
                className={`touch-manipulation border ${
                  isWall
                    ? "border-panel bg-panel"
                    : isGoal
                      ? "border-ink bg-ink"
                      : "border-dim bg-space"
                } ${isPlayer ? "border-primary bg-primary shadow-[0_0_18px_rgba(34,211,238,0.5)]" : ""}`}
              />
            );
          }),
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="grid grid-cols-3 grid-rows-3 gap-1">
          <span />
          <TerminalButton
            className="px-3 py-1 text-[11px]"
            onClick={() => step(-1, 0)}
            aria-label="move up"
          >
            ↑
          </TerminalButton>
          <span />
          <TerminalButton
            className="px-3 py-1 text-[11px]"
            onClick={() => step(0, -1)}
            aria-label="move left"
          >
            ←
          </TerminalButton>
          <TerminalButton
            className="px-3 py-1 text-[11px]"
            onClick={() => step(1, 0)}
            aria-label="move down"
          >
            ↓
          </TerminalButton>
          <TerminalButton
            className="px-3 py-1 text-[11px]"
            onClick={() => step(0, 1)}
            aria-label="move right"
          >
            →
          </TerminalButton>
        </div>
        <p className="text-[9px] uppercase tracking-[0.25em] text-dim">
          TAP OR USE ARROWS
        </p>
      </div>
    </div>
  );
}
