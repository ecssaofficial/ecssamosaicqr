"use client";

import { useEffect, useRef, useState } from "react";
import TerminalButton from "@/components/TerminalButton";

/**
 * QR 06 — TRANSMISSION (logic and level ported from
 * `project-hail-mary-games/game3-transmission.html`).
 *
 * Two stages on one fixed level.
 *   Stage 1 — six scrambled word tiles; tap letters from the pool to fill the
 *             slots (tap a filled slot to take the letter back out).
 *   Stage 2 — once all six decode, reorder the word tiles into the sentence.
 *
 * The scrambles and the stage 2 pool are both fixed and wrong-but-plausible,
 * so every deal is the same solvable puzzle.
 */

const SENTENCE = "THE CREW DETECTED AN UNUSUAL SIGNAL";
const WORDS = ["THE", "CREW", "DETECTED", "AN", "UNUSUAL", "SIGNAL"];
const SCRAMBLES = ["TEH", "RWEC", "TCDEDETE", "NA", "USUNALU", "SLGIAN"];
const POOL = ["AN", "SIGNAL", "THE", "UNUSUAL", "CREW", "DETECTED"];
const HINTS = [
  "The transmission describes an event involving the spaceship crew.",
  "The final sentence begins with \"THE\" and ends with \"SIGNAL\".",
];

type Tone = "idle" | "warn" | "danger" | "ok";

export default function Transmission({ onWin }: { onWin: () => void }) {
  const [stage, setStage] = useState<1 | 2>(1);
  const [activeIdx, setActiveIdx] = useState(0);
  const [typed, setTyped] = useState<number[]>([]);
  const [solved, setSolved] = useState<boolean[]>(() => WORDS.map(() => false));
  const [hintsUsed, setHintsUsed] = useState(0);
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    POOL.map(() => null),
  );
  const [tone, setTone] = useState<Tone>("idle");
  const [status, setStatus] = useState("SELECT A WORD TILE TO DECODE.");
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

  function flash(t: Tone, text: string, ms = 200) {
    setTone(t);
    setStatus(text);
    if (t === "danger") later(() => setTone("idle"), ms);
  }

  /* ---------- Stage 1 ---------- */

  const scrambled = SCRAMBLES[activeIdx].split("");
  const targetLen = WORDS[activeIdx].length;

  function pickLetter(charIdx: number) {
    setTyped((prev) =>
      prev.length < targetLen && !prev.includes(charIdx)
        ? [...prev, charIdx]
        : prev,
    );
  }

  function dropLetter(slotIdx: number) {
    setTyped((prev) => {
      if (prev[slotIdx] === undefined) return prev;
      const next = [...prev];
      next.splice(slotIdx, 1);
      return next;
    });
  }

  function checkWord() {
    if (stage !== 1) return;
    const answer = typed.map((idx) => scrambled[idx]).join("");

    if (answer.length < targetLen) {
      flash("warn", `PLACE ALL ${targetLen} LETTERS BEFORE CHECKING.`);
      return;
    }

    if (answer !== WORDS[activeIdx]) {
      flash("danger", "WORD STILL CORRUPTED — TRY AGAIN");
      setTyped([]);
      return;
    }

    const nextSolved = solved.map((flag, i) =>
      i === activeIdx ? true : flag,
    );
    setSolved(nextSolved);
    setTyped([]);

    if (nextSolved.every(Boolean)) {
      setStage(2);
      setTone("ok");
      setStatus("ALL WORDS DECODED — RECONSTRUCT THE SENTENCE");
      return;
    }

    const nextIdx = nextSolved.findIndex((flag) => !flag);
    setActiveIdx(nextIdx);
    setTone("ok");
    setStatus(`WORD ${activeIdx + 1} DECODED — NEXT WORD LOCKED IN`);
  }

  /* ---------- Stage 2 ---------- */

  function placeWord(word: string) {
    setSlots((prev) => {
      const empty = prev.indexOf(null);
      if (empty === -1) return prev;
      const next = [...prev];
      next[empty] = word;
      return next;
    });
  }

  function clearSlot(slotIdx: number) {
    setSlots((prev) => {
      if (!prev[slotIdx]) return prev;
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  }

  function checkSentence() {
    if (stage !== 2 || declared.current) return;

    if (slots.some((slot) => !slot)) {
      flash("warn", `PLACE ALL ${slots.length} WORDS BEFORE CHECKING.`);
      return;
    }

    if (slots.join(" ") !== SENTENCE) {
      flash("danger", "SEQUENCE INVALID — REORDER THE WORDS");
      return;
    }

    setTone("ok");
    setStatus("TRANSMISSION RESTORED");
    declared.current = true;
    later(() => onWin(), 300);
  }

  const toneClass =
    tone === "danger"
      ? "text-danger"
      : tone === "ok"
        ? "text-ink"
        : "text-white/45";

  const decodedCount = solved.filter(Boolean).length;
  const placedCount = slots.filter(Boolean).length;

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
        {stage === 1
          ? "TAP LETTERS TO SPELL EACH WORD"
          : "TAP WORDS TO REBUILD THE SENTENCE"}
      </p>

      <div className="flex gap-1">
        {WORDS.map((word, i) => (
          <span
            key={word}
            className={`h-1 flex-1 transition-colors duration-150 ${
              stage === 2 || solved[i] ? "bg-ink" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {stage === 1 ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {WORDS.map((word, i) => {
              const isSolved = solved[i];
              const isActive = i === activeIdx;
              return (
                <button
                  key={word}
                  type="button"
                  onClick={() => {
                    setActiveIdx(i);
                    setTyped([]);
                  }}
                  className={`touch-manipulation border p-2 text-left transition-colors duration-150 ${
                    isSolved
                      ? "border-ink bg-ink text-space"
                      : isActive
                        ? "border-ink bg-space text-ink"
                        : "border-white/10 bg-space text-white/45 hover:border-white/40"
                  }`}
                >
                  <span className="flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.15em] opacity-70">
                    <span>WORD {i + 1}</span>
                    <span>{isSolved ? "DECODED" : "LOCKED"}</span>
                  </span>
                  <span className="mt-1 block break-all font-mono text-[12px] font-bold tracking-[0.15em]">
                    {isSolved ? word : SCRAMBLES[i].split(" ").join(" ")}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className={`border bg-space p-3 transition-colors duration-150 ${
              tone === "danger" ? "border-danger" : "border-white/15"
            }`}
          >
            <p className="text-center font-mono text-[9px] uppercase tracking-[0.25em] text-white/45">
              UNSCRAMBLE · {scrambled.join(" · ")}
            </p>

            <div className="my-3 flex flex-wrap justify-center gap-1.5">
              {Array.from({ length: targetLen }, (_, i) => {
                const char = scrambled[typed[i]];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => dropLetter(i)}
                    aria-label={`slot ${i + 1}`}
                    className={`flex h-10 w-8 items-center justify-center border font-mono text-[14px] font-bold tracking-[0.1em] transition-colors duration-150 ${
                      char
                        ? "border-ink bg-ink text-space hover:border-danger hover:bg-space hover:text-danger"
                        : "border-white/10 text-transparent"
                    }`}
                  >
                    {char ?? "_"}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-center gap-1.5">
              {scrambled.map((char, i) => {
                const used = typed.includes(i);
                return (
                  <button
                    key={`${char}-${i}`}
                    type="button"
                    onClick={() => pickLetter(i)}
                    disabled={used}
                    aria-label={`letter ${char}`}
                    className={`flex h-10 w-8 items-center justify-center border font-mono text-[14px] font-bold tracking-[0.1em] transition-colors duration-150 ${
                      used
                        ? "cursor-not-allowed border-white/5 text-white/15"
                        : "border-white/25 text-ink hover:border-ink hover:bg-ink hover:text-space"
                    }`}
                  >
                    {char}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <TerminalButton
              className="py-2.5 text-[10px]"
              onClick={() => setTyped([])}
            >
              CLEAR
            </TerminalButton>
            <TerminalButton
              className="py-2.5 text-[10px]"
              onClick={() => setHintsUsed((n) => Math.min(n + 1, HINTS.length))}
            >
              HINT ({hintsUsed}/{HINTS.length})
            </TerminalButton>
            <TerminalButton
              variant="primary"
              className="py-2.5 text-[10px]"
              onClick={checkWord}
            >
              CHECK
            </TerminalButton>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {POOL.map((word) => {
              const countIn = slots.filter((slot) => slot === word).length;
              const countTotal = POOL.filter((w) => w === word).length;
              const used = countIn >= countTotal;
              return (
                <button
                  key={word}
                  type="button"
                  onClick={() => placeWord(word)}
                  disabled={used || declared.current}
                  className={`border px-2 py-2 font-mono text-[11px] font-bold tracking-[0.15em] transition-colors duration-150 ${
                    used
                      ? "cursor-not-allowed border-white/5 text-white/15"
                      : "border-white/25 text-ink hover:border-ink hover:bg-ink hover:text-space"
                  }`}
                >
                  {word}
                </button>
              );
            })}
          </div>

          <div
            className={`border bg-space p-3 transition-colors duration-150 ${
              tone === "danger" ? "border-danger" : "border-white/15"
            }`}
          >
            {slots.map((word, i) => (
              <button
                key={i}
                type="button"
                onClick={() => clearSlot(i)}
                className={`flex w-full items-center justify-between border px-2 py-2 text-left font-mono text-[11px] font-bold tracking-[0.15em] transition-colors duration-150 ${
                  word
                    ? "border-white/10 text-ink hover:border-danger hover:text-danger"
                    : "border-white/5 text-white/15"
                } ${i > 0 ? "mt-1.5" : ""}`}
              >
                <span className="opacity-50">{String(i + 1).padStart(2, "0")}</span>
                <span>{word ?? "—"}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <TerminalButton
              className="py-3"
              onClick={() => setSlots(POOL.map(() => null))}
            >
              RESET ORDER
            </TerminalButton>
            <TerminalButton
              variant="primary"
              className="py-3"
              onClick={checkSentence}
            >
              CHECK
            </TerminalButton>
          </div>
        </>
      )}

      <p
        aria-live="polite"
        className={`min-h-[14px] text-center font-mono text-[10px] uppercase tracking-[0.25em] ${toneClass}`}
      >
        {status}
      </p>

      {hintsUsed > 0 ? (
        <div className="border border-white/25 bg-space p-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/45">
            TRANSMISSION HINT ({hintsUsed}/{HINTS.length})
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink">
            {HINTS[Math.min(hintsUsed - 1, HINTS.length - 1)]}
          </p>
        </div>
      ) : null}

      <p className="text-center font-mono text-[9px] uppercase tracking-[0.3em] text-white/25">
        {stage === 1
          ? `STAGE 01 · ${decodedCount}/${WORDS.length} DECODED`
          : `STAGE 02 · ${placedCount}/${slots.length} ORDERED`}
      </p>
    </div>
  );
}
