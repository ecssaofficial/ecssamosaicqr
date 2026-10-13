"use client";

import { useEffect, useRef, useState } from "react";
import TerminalButton from "@/components/TerminalButton";

/**
 * QR 04 — ALIEN SIGNAL (logic and level ported from
 * `project-hail-mary-games/game2-alien-signal.html`).
 *
 * Each session deals a fresh word from a fixed 32-word pool. The translation
 * key maps one glyph to every distinct letter of that word, plus 0–2 decoy
 * glyphs for letters the word does not contain. The ciphertext shows the
 * word's glyphs in order; the player types what it decodes to.
 *
 * A deal is only used if every letter of the word is reachable, so it is
 * always solvable from the key alone.
 */

const ALIEN_WORDS = [
  "STAR",
  "COMET",
  "NOVA",
  "MARS",
  "ALIEN",
  "SOLAR",
  "LIGHT",
  "VOYAGE",
  "COSMOS",
  "NEBULA",
  "GALAXY",
  "PLASMA",
  "QUASAR",
  "ROVER",
  "FUSION",
  "SIGNAL",
  "MAYDAY",
  "ALERT",
  "CRYO",
  "AURORA",
  "ECLIPSE",
  "STELLAR",
  "MISSION",
  "SATELLITE",
  "MERCURY",
  "PLUTO",
  "SATURN",
  "VENUS",
  "EARTH",
  "CERES",
  "PULSAR",
  "ALPHA",
  "OMEGA",
];

const GLYPH_POOL = [
  "✦",
  "⌘",
  "◈",
  "⟁",
  "☼",
  "❖",
  "♆",
  "✷",
  "⊘",
  "⬢",
  "◉",
  "✧",
  "⌬",
  "✺",
  "⚑",
  "✵",
];

const GLYPH_NAMES = [
  "Aster",
  "Vortex",
  "Prism",
  "Rift",
  "Helios",
  "Quark",
  "Nebula",
  "Pulsar",
  "Comet",
  "Quantum",
  "Drift",
  "Beacon",
  "Ion",
  "Warp",
  "Flux",
  "Echo",
];

type KeyEntry = { g: string; n: string; l: string };
type Deal = { word: string; key: KeyEntry[] };

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function fisherYates<T>(input: readonly T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A deal is solvable only if every letter of the word has a glyph. */
function dealValid(deal: Deal): boolean {
  if (!deal || typeof deal.word !== "string" || !Array.isArray(deal.key)) {
    return false;
  }
  if (!/^[A-Z]{3,9}$/.test(deal.word)) return false;
  if (deal.key.length < 3 || deal.key.length > 8) return false;

  const letterToGlyph: Record<string, string> = {};
  const glyphsSeen = new Set<string>();
  const lettersSeen = new Set<string>();

  for (const entry of deal.key) {
    if (!entry || !/^[A-Z]$/.test(entry.l)) return false;
    if (typeof entry.g !== "string" || entry.g.length === 0) return false;
    if (glyphsSeen.has(entry.g) || lettersSeen.has(entry.l)) return false;
    glyphsSeen.add(entry.g);
    lettersSeen.add(entry.l);
    letterToGlyph[entry.l] = entry.g;
  }

  for (const letter of deal.word) {
    if (!letterToGlyph[letter]) return false;
  }
  return true;
}

function generateDeal(): Deal {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const word = fisherYates(ALIEN_WORDS)[0];
    const letters = Array.from(new Set(word.split("")));
    const decoyCount = Math.floor(Math.random() * 3);
    const decoys = fisherYates(
      ALPHABET.filter((c) => letters.indexOf(c) === -1),
    ).slice(0, decoyCount);
    const all = fisherYates(letters.concat(decoys));
    const glyphs = fisherYates(GLYPH_POOL);
    const names = fisherYates(GLYPH_NAMES);
    const deal: Deal = {
      word,
      key: all.map((l, i) => ({ g: glyphs[i], n: names[i], l })),
    };
    if (dealValid(deal)) return deal;
  }
  // Unreachable in practice: three letters, no decoys.
  const fallback = "STAR";
  return {
    word: fallback,
    key: fisherYates(fallback.split("")).map((l, i) => ({
      g: GLYPH_POOL[i],
      n: GLYPH_NAMES[i],
      l,
    })),
  };
}

type Tone = "idle" | "warn" | "danger" | "ok";

export default function AlienSignal({ onWin }: { onWin: () => void }) {
  const [deal, setDeal] = useState<Deal>(() => generateDeal());
  const [entered, setEntered] = useState("");
  const [marked, setMarked] = useState<KeyEntry | null>(null);
  const [tone, setTone] = useState<Tone>("idle");
  const [status, setStatus] = useState("TAP A GLYPH TO MARK IT, THEN TYPE.");
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  const declared = useRef(false);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  const { word, key } = deal;

  const letterToGlyph = new Map<string, string>(
    key.map((entry) => [entry.l, entry.g]),
  );
  const ciphertext = word.split("").map((ch) => letterToGlyph.get(ch) ?? "?");

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function type(text: string) {
    if (declared.current) return;
    setEntered((prev) =>
      prev.length >= word.length ? prev : `${prev}${text}`.slice(0, word.length),
    );
    if (tone !== "idle") {
      setTone("idle");
      setStatus("MATCH EACH GLYPH TO ITS LETTER.");
    }
  }

  function backspace() {
    if (declared.current) return;
    setEntered((prev) => prev.slice(0, -1));
  }

  function check() {
    if (declared.current) return;
    if (entered.length < word.length) {
      setTone("warn");
      setStatus(`INCOMPLETE SIGNAL — ENTER ALL ${word.length} LETTERS.`);
      return;
    }
    if (entered !== word) {
      setTone("danger");
      setStatus("TRANSLATION INCORRECT — CHECK THE KEY");
      return;
    }
    setTone("ok");
    setStatus("SIGNAL DECODED");
    declared.current = true;
    later(() => onWin(), 260);
  }

  /* Desktop convenience: the field is the source of truth, but a physical
     keyboard works even when it is not focused. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = inputRef.current;
      if (!el || e.target === el) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        type(e.key.toUpperCase());
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        check();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const cols = key.length <= 5 ? key.length : 4;
  const toneClass =
    tone === "danger"
      ? "text-danger"
      : tone === "warn"
        ? "text-white/45"
        : tone === "ok"
          ? "text-ink"
          : "text-white/45";

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
        READ THE KEY, DECODE THE CIPHERTEXT
      </p>

      <div className="border border-white/15 bg-space p-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/45">
          ALIEN TRANSLATION KEY
        </p>
        <div
          className="mt-3 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
        >
          {key.map((entry) => {
            const active = marked?.g === entry.g;
            return (
              <button
                key={entry.g}
                type="button"
                onClick={() => setMarked(active ? null : entry)}
                aria-label={`glyph ${entry.n} is letter ${entry.l}`}
                aria-pressed={active}
                className={`flex touch-manipulation flex-col items-center gap-1 border px-1 py-2 transition-colors duration-150 ${
                  active
                    ? "border-ink bg-ink text-space"
                    : "border-white/10 text-white/70 hover:border-white/40 hover:text-ink"
                }`}
              >
                <span className="text-[20px] leading-none">{entry.g}</span>
                <span className="font-mono text-[8px] uppercase tracking-[0.15em] opacity-60">
                  {entry.n}
                </span>
                <span className="font-mono text-[13px] font-bold leading-none tracking-[0.2em]">
                  {entry.l}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border border-white/15 bg-space p-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/45">
          ENCRYPTED MESSAGE
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {ciphertext.map((glyph, i) => (
            <span
              key={`${glyph}-${i}`}
              className={`flex h-9 min-w-[34px] items-center justify-center border px-1 text-[20px] leading-none transition-colors duration-150 ${
                marked && marked.g === glyph
                  ? "border-ink bg-ink text-space"
                  : "border-white/10 text-white/70"
              }`}
            >
              {glyph}
            </span>
          ))}
        </div>
      </div>

      <div
        className={`relative border bg-space p-3 transition-colors duration-150 ${
          tone === "danger" ? "border-danger" : "border-white/15"
        }`}
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/45">
          YOUR DECODE
        </p>
        <div className="my-3 flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: word.length }, (_, i) => (
            <span
              key={i}
              className={`flex h-10 w-8 items-center justify-center border font-mono text-[15px] font-bold tracking-[0.1em] ${
                i < entered.length
                  ? "border-ink bg-ink text-space"
                  : i === entered.length
                    ? "border-white/45 text-transparent"
                    : "border-white/10 text-transparent"
              }`}
            >
              {i < entered.length ? entered[i] : "_"}
            </span>
          ))}
        </div>
        <p className="text-center font-mono text-[9px] tracking-[0.3em] text-white/25">
          {entered.length}/{word.length}
        </p>
        <input
          ref={inputRef}
          value={entered}
          onChange={(e) => type(e.target.value.slice(-1).toUpperCase())}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            check();
          }}
          aria-label="Type the decoded word"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0"
        />
      </div>

      <p
        aria-live="polite"
        className={`min-h-[14px] text-center font-mono text-[10px] uppercase tracking-[0.25em] ${toneClass}`}
      >
        {status}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <TerminalButton
          className="py-3"
          onClick={() => {
            if (declared.current) return;
            setEntered("");
            setTone("idle");
            setStatus("FIELD CLEARED.");
          }}
          disabled={declared.current}
        >
          CLEAR
        </TerminalButton>
        <TerminalButton variant="primary" className="py-3" onClick={check}>
          CHECK
        </TerminalButton>
      </div>
    </div>
  );
}
