"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TerminalButton from "@/components/TerminalButton";

const PADS = 9;
const LENGTH = 5;
const STEP_MS = 700;
const FLASH_MS = 420;

export default function SequenceTap({ onWin }: { onWin: () => void }) {
  const [sequence, setSequence] = useState<number[] | null>(null);
  const [lit, setLit] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const declared = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => {
    setSequence(
      Array.from({ length: LENGTH }, () => Math.floor(Math.random() * PADS)),
    );
    return clearTimers;
  }, [clearTimers]);

  const play = useCallback(
    (seq: number[]) => {
      clearTimers();
      setActive(false);
      setFailed(false);
      setStep(0);
      seq.forEach((pad, i) => {
        timers.current.push(
          window.setTimeout(() => setLit(pad), i * STEP_MS),
          window.setTimeout(() => setLit(null), i * STEP_MS + FLASH_MS),
        );
      });
      timers.current.push(
        window.setTimeout(() => {
          setLit(null);
          setActive(true);
        }, seq.length * STEP_MS + 120),
      );
    },
    [clearTimers],
  );

  useEffect(() => {
    if (sequence) play(sequence);
  }, [sequence, attempt, play]);

  function tap(pad: number) {
    if (!active || !sequence) return;

    setLit(pad);
    timers.current.push(window.setTimeout(() => setLit(null), 160));

    if (pad === sequence[step]) {
      if (step + 1 === sequence.length) {
        setActive(false);
        setStep(0);
        if (!declared.current) {
          declared.current = true;
          onWin();
        }
        return;
      }
      setStep(step + 1);
      return;
    }

    // wrong pad: replay the very same sequence, no lock-out
    setActive(false);
    setFailed(true);
    timers.current.push(
      window.setTimeout(() => {
        setFailed(false);
        setAttempt((n) => n + 1);
      }, 900),
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.25em] text-dim">
          {active ? "REPEAT THE SEQUENCE" : "WATCH THE SEQUENCE"}
        </p>
        <TerminalButton
          className="px-2 py-1 text-[9px]"
          onClick={() => setAttempt((n) => n + 1)}
        >
          REPLAY
        </TerminalButton>
      </div>

      <div className="grid aspect-square w-full grid-cols-3 grid-rows-3 gap-1.5">
        {Array.from({ length: PADS }, (_, pad) => (
          <button
            key={pad}
            type="button"
            onClick={() => tap(pad)}
            aria-label={`pad ${pad + 1}`}
            // a lit pad is a solid cyan block, an idle pad is a dark cell
            className={`touch-manipulation border transition-colors duration-100 ${
              lit === pad
                ? "border-primary bg-primary shadow-[0_0_28px_rgba(34,211,238,0.45)]"
                : "border-dim bg-space"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: LENGTH }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 ${i < step ? "bg-primary" : "bg-dim"}`}
            />
          ))}
        </div>
        {failed ? (
          <p className="text-[10px] uppercase tracking-[0.25em] text-danger">
            SIGNAL LOST
          </p>
        ) : null}
      </div>
    </div>
  );
}
