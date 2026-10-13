"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import TerminalButton from "@/components/TerminalButton";
import { PUZZLE_IMAGE } from "@/lib/config";

const SIZE = 3;
const BLANK = SIZE * SIZE - 1;
const SOLVED = [0, 1, 2, 3, 4, 5, 6, 7, 8];

function neighbours(slot: number): number[] {
  const r = Math.floor(slot / SIZE);
  const c = slot % SIZE;
  const out: number[] = [];
  if (r > 0) out.push(slot - SIZE);
  if (r < SIZE - 1) out.push(slot + SIZE);
  if (c > 0) out.push(slot - 1);
  if (c < SIZE - 1) out.push(slot + 1);
  return out;
}

/** Shuffle by walking the blank around: every deal is guaranteed solvable. */
function deal(): number[] {
  const tiles = [...SOLVED];
  let blank = BLANK;
  let cameFrom = -1;
  for (let i = 0; i < 80; i += 1) {
    const options = neighbours(blank).filter((s) => s !== cameFrom);
    const pick = options[Math.floor(Math.random() * options.length)];
    cameFrom = blank;
    tiles[blank] = tiles[pick];
    tiles[pick] = BLANK;
    blank = pick;
  }
  return tiles;
}

export default function SlidingPuzzle({ onWin }: { onWin: () => void }) {
  const [tiles, setTiles] = useState<number[] | null>(null);
  const declared = useRef(false);

  useEffect(() => {
    setTiles(deal());
  }, []);

  const solved = tiles !== null && tiles.every((tile, slot) => tile === slot);

  useEffect(() => {
    if (solved && !declared.current) {
      declared.current = true;
      onWin();
    }
  }, [solved, onWin]);

  function move(slot: number) {
    if (!tiles || solved) return;
    const blank = tiles.indexOf(BLANK);
    if (!neighbours(blank).includes(slot)) return;
    const next = [...tiles];
    next[blank] = next[slot];
    next[slot] = BLANK;
    setTiles(next);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.25em] text-dim">
          SLIDE THE TILES INTO PLACE
        </p>
        <TerminalButton
          className="px-2 py-1 text-[9px]"
          onClick={() => setTiles(deal())}
        >
          RESET
        </TerminalButton>
      </div>

      <div className="grid aspect-square w-full grid-cols-3 grid-rows-3 gap-1">
        {tiles
          ? tiles.map((tile, slot) =>
              tile === BLANK ? (
                <div key="blank" />
              ) : (
                <motion.button
                  key={tile}
                  layout
                  type="button"
                  onClick={() => move(slot)}
                  aria-label={`tile ${tile + 1}`}
                  className="touch-manipulation border border-dim"
                  style={{
                    gridRow: Math.floor(slot / SIZE) + 1,
                    gridColumn: (slot % SIZE) + 1,
                    backgroundImage: `url(${PUZZLE_IMAGE})`,
                    backgroundSize: "300% 300%",
                    backgroundPosition: `${(tile % SIZE) * 50}% ${
                      Math.floor(tile / SIZE) * 50
                    }%`,
                  }}
                />
              ),
            )
          : null}
      </div>
    </div>
  );
}
