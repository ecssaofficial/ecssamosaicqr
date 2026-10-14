"use client";

import { useEffect, useRef, useState } from "react";
import TerminalButton from "@/components/TerminalButton";

/**
 * QR 06 — TRANSMISSION (stage structure ported from
 * `project-hail-mary-games/game3-transmission.html`, sentence pool and
 * auto-checking added for ORBIT).
 *
 * Each session deals one sentence from the pool below.
 *   Stage 1 — unscramble every word. As soon as the last letter of a word is
 *             placed it is checked automatically: correct words lock in and
 *             the next one opens, wrong ones clear themselves.
 *   Stage 2 — reorder the word tiles into the sentence. The moment all slots
 *             are filled it is checked automatically.
 *
 * Every scramble is a true anagram of its word and never the word itself, so
 * each deal is solvable from the tiles alone.
 */

const SENTENCES = [
  "THE CREW DETECTED AN UNUSUAL SIGNAL",
  "THE SHIP IS LOST IN SPACE",
  "WE MUST FIND OUR WAY HOME",
  "THE STAR IS BIG AND BRIGHT",
  "A NEW WORLD IS OUT THERE",
  "THE ENGINE IS DEAD AND COLD",
  "ONE MAN CAN SAVE US ALL",
  "THE SUN WILL RISE AGAIN",
];

/** Hints per stage: the third one is the answer itself. */
function wordHints(word: string, index: number, total: number): string[] {
  return [
    `WORD ${index + 1} OF ${total} — ${word.length} LETTERS, STARTS WITH "${word[0]}".`,
    `THE LETTERS ARE: ${[...word].sort().join(" · ")}`,
    `ANSWER: ${word}`,
  ];
}

function sentenceHints(words: string[], sentence: string): string[] {
  return [
    `THE SENTENCE HAS ${words.length} WORDS.`,
    `IT STARTS WITH "${words[0]}" AND ENDS WITH "${words[words.length - 1]}".`,
    `ANSWER: ${sentence}`,
  ];
}

type Tone = "idle" | "danger" | "ok";
type Deal = {
  sentence: string;
  words: string[];
  scrambles: string[];
  pool: string[];
};

function fisherYates<T>(input: readonly T[]): T[] {
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

/** A true anagram that is never the word itself. */
function scrambleWord(word: string): string {
  const chars = word.split("");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const shuffled = fisherYates(chars).join("");
    if (shuffled !== word) return shuffled;
  }
  // Only reachable for a 2-letter word: rotate it instead.
  return chars.slice(1).concat(chars[0]).join("");
}

/** Word tiles for stage 2, shuffled so they never start in sentence order. */
function dealPool(words: string[]): string[] {
  const target = words.join(" ");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const shuffled = fisherYates(words);
    if (shuffled.join(" ") !== target) return shuffled;
  }
  return [...words].reverse();
}

function dealTranscript(): Deal {
  const sentence = pick(SENTENCES);
  const words = sentence.split(" ");
  return {
    sentence,
    words,
    scrambles: words.map(scrambleWord),
    pool: dealPool(words),
  };
}

export default function Transmission({ onWin }: { onWin: () => void }) {
  const [deal, setDeal] = useState<Deal>(() => dealTranscript());
  const [stage, setStage] = useState<1 | 2>(1);
  const [activeIdx, setActiveIdx] = useState(0);
  const [typed, setTyped] = useState<number[]>([]);
  const [solved, setSolved] = useState<boolean[]>(() =>
    deal.words.map(() => false),
  );
  const [hintsUsed, setHintsUsed] = useState(0);
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    deal.pool.map(() => null),
  );
  const [tone, setTone] = useState<Tone>("idle");
  const [status, setStatus] = useState("SELECT A WORD TILE TO DECODE.");
  const timers = useRef<number[]>([]);
  const busy = useRef(false);
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

  const { sentence, words, scrambles, pool } = deal;
  const scrambled = scrambles[activeIdx];
  const targetLen = words[activeIdx].length;

  /* Hints describe whatever is on screen right now: the active word while
     decoding, the whole sentence once every word is decoded. */
  const hints =
    stage === 1
      ? wordHints(words[activeIdx], activeIdx, words.length)
      : sentenceHints(words, sentence);
  const hintCount = hints.length;

  /* Each word (and the sentence) gets its own run of hints, so the third
     one always reveals the answer to whatever is currently being solved. */
  useEffect(() => {
    setHintsUsed(0);
  }, [activeIdx, stage]);

  /* ---------- Stage 1: auto-check as soon as the word is full ---------- */
  useEffect(() => {
    if (stage !== 1 || busy.current || solved[activeIdx]) return;
    if (typed.length < targetLen) return;

    const answer = typed.map((idx) => scrambled[idx]).join("");

    if (answer !== words[activeIdx]) {
      busy.current = true;
      setTone("danger");
      setStatus("WORD STILL CORRUPTED — TRY AGAIN");
      later(() => {
        setTyped([]);
        setTone("idle");
        setStatus("TAP LETTERS TO SPELL EACH WORD");
        busy.current = false;
      }, 450);
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
    setStatus(`WORD ${activeIdx + 1} DECODED — NEXT WORD OPEN`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, stage, activeIdx, solved, targetLen, scrambled, words]);

  /* ---------- Stage 2: auto-check the moment every slot is filled ---------- */
  useEffect(() => {
    if (stage !== 2 || busy.current || declared.current) return;
    if (slots.some((slot) => !slot)) return;

    if (slots.join(" ") !== sentence) {
      busy.current = true;
      setTone("danger");
      setStatus("SEQUENCE INVALID — REORDER THE WORDS");
      later(() => {
        setSlots(pool.map(() => null));
        setTone("idle");
        setStatus("TAP WORDS TO REBUILD THE SENTENCE");
        busy.current = false;
      }, 450);
      return;
    }

    setTone("ok");
    setStatus("TRANSMISSION RESTORED");
    declared.current = true;
    later(() => onWin(), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, stage]);

  /* ---------- Interactions ---------- */

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

  function newDeal() {
    const next = dealTranscript();
    setDeal(next);
    setStage(1);
    setActiveIdx(0);
    setTyped([]);
    setSolved(next.words.map(() => false));
    setSlots(next.pool.map(() => null));
    setHintsUsed(0);
    setTone("idle");
    setStatus("TAP LETTERS TO SPELL EACH WORD");
  }

  const toneClass = tone === "danger" ? "text-danger" : tone === "ok" ? "text-ink" : "text-white/45";
  const decodedCount = solved.filter(Boolean).length;
  const placedCount = slots.filter(Boolean).length;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
          {stage === 1 ? "TAP LETTERS TO SPELL EACH WORD" : "TAP WORDS TO REBUILD THE SENTENCE"}
        </p>
        <TerminalButton className="px-2 py-1 text-[9px]" onClick={newDeal}>
          NEW
        </TerminalButton>
      </div>

      <div className="flex gap-1">
        {words.map((word, i) => (
          <span key={word} className={`h-1 flex-1 transition-colors duration-150 ${stage === 2 || solved[i] ? "bg-ink" : "bg-white/10"}`} />
        ))}
      </div>

      {stage === 1 ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {words.map((word, i) => {
              const isSolved = solved[i];
              const isActive = i === activeIdx;
              return (
                <button
                  key={`${word}-${i}`}
                  type="button"
                  onClick={() => {
                    setActiveIdx(i);
                    setTyped([]);
                  }}
                  className={`touch-manipulation border p-2 text-left transition-colors duration-150 ${isSolved ? "border-ink bg-ink text-space" : isActive ? "border-ink bg-space text-ink" : "border-white/10 bg-space text-white/45 hover:border-white/40"}`}
                >
                  <span className="flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.15em] opacity-70">
                    <span>WORD {i + 1}</span>
                    <span>{isSolved ? "DECODED" : "LOCKED"}</span>
                  </span>
                  <span className="mt-1 block break-all font-mono text-[12px] font-bold tracking-[0.15em]">
                    {isSolved ? word : scrambles[i].split("").join(" ")}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={`border bg-space p-3 transition-colors duration-150 ${tone === "danger" ? "border-danger" : "border-white/15"}`}>
            <p className="text-center font-mono text-[9px] uppercase tracking-[0.25em] text-white/45">
              UNSCRAMBLE · {scrambled.split("").join(" · ")}
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
                    className={`flex h-10 w-8 items-center justify-center border font-mono text-[14px] font-bold tracking-[0.1em] transition-colors duration-150 ${char ? "border-ink bg-ink text-space hover:border-danger hover:bg-space hover:text-danger" : "border-white/10 text-transparent"}`}
                  >
                    {char ?? "_"}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-center gap-1.5">
              {scrambled.split("").map((char, i) => {
                const used = typed.includes(i);
                return (
                  <button
                    key={`${char}-${i}`}
                    type="button"
                    onClick={() => pickLetter(i)}
                    disabled={used}
                    aria-label={`letter ${char}`}
                    className={`flex h-10 w-8 items-center justify-center border font-mono text-[14px] font-bold tracking-[0.1em] transition-colors duration-150 ${used ? "cursor-not-allowed border-white/5 text-white/15" : "border-white/25 text-ink hover:border-ink hover:bg-ink hover:text-space"}`}
                  >
                    {char}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <TerminalButton className="py-3 text-[10px]" onClick={() => setTyped([])}>
              CLEAR
            </TerminalButton>
            <TerminalButton
              className="py-3 text-[10px]"
              onClick={() => setHintsUsed((n) => Math.min(n + 1, hintCount))}
            >
              HINT ({hintsUsed}/{hintCount})
            </TerminalButton>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {pool.map((word, i) => {
              const countIn = slots.filter((slot) => slot === word).length;
              const countTotal = pool.filter((w) => w === word).length;
              const used = countIn >= countTotal;
              return (
                <button
                  key={`${word}-${i}`}
                  type="button"
                  onClick={() => placeWord(word)}
                  disabled={used || declared.current}
                  className={`border px-2 py-2 font-mono text-[11px] font-bold tracking-[0.15em] transition-colors duration-150 ${used ? "cursor-not-allowed border-white/5 text-white/15" : "border-white/25 text-ink hover:border-ink hover:bg-ink hover:text-space"}`}
                >
                  {word}
                </button>
              );
            })}
          </div>

          <div className={`border bg-space p-3 transition-colors duration-150 ${tone === "danger" ? "border-danger" : "border-white/15"}`}>
            {slots.map((word, i) => (
              <button
                key={i}
                type="button"
                onClick={() => clearSlot(i)}
                className={`flex w-full items-center justify-between border px-2 py-2 text-left font-mono text-[11px] font-bold tracking-[0.15em] transition-colors duration-150 ${word ? "border-white/10 text-ink hover:border-danger hover:text-danger" : "border-white/5 text-white/15"} ${i > 0 ? "mt-1.5" : ""}`}
              >
                <span className="opacity-50">{String(i + 1).padStart(2, "0")}</span>
                <span>{word ?? "—"}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <TerminalButton
              className="py-3 text-[10px]"
              onClick={() => setSlots(pool.map(() => null))}
            >
              RESET ORDER
            </TerminalButton>
            <TerminalButton
              className="py-3 text-[10px]"
              onClick={() => setHintsUsed((n) => Math.min(n + 1, hintCount))}
            >
              HINT ({hintsUsed}/{hintCount})
            </TerminalButton>
          </div>
        </>
      )}

      <p aria-live="polite" className={`min-h-[14px] text-center font-mono text-[10px] uppercase tracking-[0.25em] ${toneClass}`}>
        {status}
      </p>

      {hintsUsed > 0 ? (
        <div
          className={`border p-2.5 transition-colors duration-150 ${
            hintsUsed >= hintCount
              ? "border-ink bg-ink"
              : "border-white/25 bg-space"
          }`}
        >
          <p
            className={`font-mono text-[9px] uppercase tracking-[0.25em] ${
              hintsUsed >= hintCount ? "text-space/60" : "text-white/45"
            }`}
          >
            TRANSMISSION HINT ({hintsUsed}/{hintCount})
          </p>
          <p
            className={`mt-1.5 font-mono text-[11px] leading-relaxed tracking-[0.12em] ${
              hintsUsed >= hintCount ? "font-bold text-space" : "text-ink"
            }`}
          >
            {hints[Math.min(hintsUsed - 1, hintCount - 1)]}
          </p>
        </div>
      ) : null}

      <p className="text-center font-mono text-[9px] uppercase tracking-[0.3em] text-white/25">
        {stage === 1
          ? `STAGE 01 · ${decodedCount}/${words.length} DECODED`
          : `STAGE 02 · ${placedCount}/${slots.length} ORDERED`}
      </p>
    </div>
  );
}
