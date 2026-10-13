"use client";

import { useEffect, useRef, useState } from "react";
import TerminalButton from "@/components/TerminalButton";

const GLYPHS = ["◇", "△", "□", "○", "✦", "⬡", "+", "⬟"];

type Card = { key: string; glyph: string };

function deal(): Card[] {
  const deck: Card[] = GLYPHS.flatMap((glyph, i) => [
    { key: `${i}-a`, glyph },
    { key: `${i}-b`, glyph },
  ]);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = deck[i];
    deck[i] = deck[j];
    deck[j] = swap;
  }
  return deck;
}

export default function MemoryFlip({ onWin }: { onWin: () => void }) {
  const [deck, setDeck] = useState<Card[] | null>(null);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [locked, setLocked] = useState(false);
  const declared = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setDeck(deal());
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const complete = matched.size === GLYPHS.length * 2;

  useEffect(() => {
    if (complete && !declared.current) {
      declared.current = true;
      onWin();
    }
  }, [complete, onWin]);

  function flip(index: number) {
    if (!deck || locked || complete) return;
    if (flipped.includes(index) || matched.has(index)) return;

    const next = [...flipped, index];
    setFlipped(next);

    if (next.length < 2) return;

    const [a, b] = next;
    if (deck[a].glyph === deck[b].glyph) {
      setMatched((prev) => new Set(prev).add(a).add(b));
      setFlipped([]);
      return;
    }

    setLocked(true);
    timer.current = window.setTimeout(() => {
      setFlipped([]);
      setLocked(false);
    }, 800);
  }

  function reset() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setDeck(deal());
    setFlipped([]);
    setMatched(new Set());
    setLocked(false);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.25em] text-dim">
          MATCH EVERY PAIR
        </p>
        <TerminalButton className="px-2 py-1 text-[9px]" onClick={reset}>
          RESET
        </TerminalButton>
      </div>

      <div className="grid aspect-square w-full grid-cols-4 grid-rows-4 gap-1.5">
        {deck
          ? deck.map((card, i) => {
              const isMatched = matched.has(i);
              const isOpen = isMatched || flipped.includes(i);
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => flip(i)}
                  // flat states: dim border = face down (glyph painted in the
                  // panel colour so it is invisible), cyan = revealed,
                  // green = matched
                  className={`flex touch-manipulation items-center justify-center border text-2xl sm:text-3xl ${
                    isMatched
                      ? "border-success text-success"
                      : isOpen
                        ? "border-primary text-primary"
                        : "border-dim bg-panel text-panel"
                  }`}
                >
                  {card.glyph}
                </button>
              );
            })
          : null}
      </div>
    </div>
  );
}
