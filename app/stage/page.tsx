"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SpaceBg from "@/components/SpaceBg";
import {
  PUZZLE_IMAGE,
  TOTAL_PIECES,
  label,
  siteUrl,
  writeSessionStamp,
} from "@/lib/config";
import {
  getPieceSVG,
  pieceBoxOffset,
  pieceBoxPx,
  pieceRowCol,
} from "@/lib/jigsaw";
import {
  fetchPieces,
  resetPieces,
  subscribePieces,
  type PieceRow,
} from "@/lib/supabase";

/** Thumbnail cell size in the tray (px). The drawn box is a little larger. */
const TRAY_CELL = 84;
const DRAG_SCALE = 1.8;
const DROP_TOLERANCE = 14;

type Drag = {
  index: number;
  x: number;
  y: number;
  offX: number;
  offY: number;
};

/**
 * One jigsaw piece, rendered from the shared SVG generator. The artwork is
 * desaturated by the `.piece-art` rule in globals.css; the outline colour
 * comes from `currentColor` on the wrapper (white/40, white while dragging,
 * red for a wrong drop).
 */
function PieceArt({
  index,
  cell,
  uid,
  className = "",
  style,
}: {
  index: number;
  cell: number;
  uid: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const html = useMemo(() => getPieceSVG(index, cell, uid), [index, cell, uid]);
  return (
    <div
      className={`piece-art ${className}`}
      style={{ width: pieceBoxPx(cell), height: pieceBoxPx(cell), ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function StagePage() {
  const [pieces, setPieces] = useState<PieceRow[] | null>(null);
  const [placed, setPlaced] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<"play" | "cleared">("play");
  const [boardSize, setBoardSize] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [slotFlash, setSlotFlash] = useState<{ slot: number; n: number } | null>(
    null,
  );
  const [trayFlash, setTrayFlash] = useState<number | null>(null);

  const dragRef = useRef<Drag | null>(null);
  const timers = useRef<number[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<Array<HTMLDivElement | null>>([]);

  const setDragState = useCallback((next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  useEffect(() => {
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  /* ---------------- live data ---------------- */

  const refresh = useCallback(async () => {
    const rows = await fetchPieces();
    setPieces(rows);
    // Every piece back to unearned means a new team: clear the board.
    if (rows.every((row) => !row.earned)) {
      setPlaced((prev) => (prev.size === 0 ? prev : new Set<number>()));
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribePieces(() => {
      void refresh();
    });
  }, [refresh]);

  /* ---------------- board sizing ---------------- */

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const size = Math.min(el.clientWidth, el.clientHeight) - 8;
      setBoardSize(size > 0 ? size : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cell = boardSize > 0 ? boardSize / 3 : 0;

  const trayPieces = useMemo(
    () =>
      (pieces ?? [])
        .filter((piece) => piece.earned && !placed.has(piece.id - 1))
        .map((piece) => piece.id - 1),
    [pieces, placed],
  );

  /* ---------------- drag & drop ---------------- */

  const slotAt = useCallback((x: number, y: number): number | null => {
    for (let i = 0; i < TOTAL_PIECES; i += 1) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (
        x >= rect.left - DROP_TOLERANCE &&
        x <= rect.right + DROP_TOLERANCE &&
        y >= rect.top - DROP_TOLERANCE &&
        y <= rect.bottom + DROP_TOLERANCE
      ) {
        return i;
      }
    }
    return null;
  }, []);

  const finishDrag = useCallback(
    (x: number, y: number) => {
      const current = dragRef.current;
      if (!current) return;
      setDragState(null);

      const target = slotAt(x, y);
      if (target === current.index) {
        setPlaced((prev) => {
          const next = new Set(prev);
          next.add(current.index);
          return next;
        });
        // correct drop: the slot border flashes solid white once, 200ms
        setSlotFlash({ slot: current.index, n: Date.now() });
        later(() => setSlotFlash(null), 220);
        return;
      }

      // wrong slot — or dropped outside the board: the piece outline flashes
      // red once and the piece returns to the tray. No penalty.
      setTrayFlash(current.index);
      later(() => setTrayFlash(null), 220);
    },
    [later, setDragState, slotAt],
  );

  const dragging = drag !== null;

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      setDragState({ ...current, x: event.clientX, y: event.clientY });
    };
    const onUp = (event: PointerEvent) => finishDrag(event.clientX, event.clientY);
    const onCancel = () => finishDrag(-1, -1);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [dragging, finishDrag, setDragState]);

  function startDrag(event: React.PointerEvent<HTMLDivElement>, index: number) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setDragState({
      index,
      x: event.clientX,
      y: event.clientY,
      offX: event.clientX - rect.left,
      offY: event.clientY - rect.top,
    });
  }

  /* ---------------- win sequence ---------------- */

  useEffect(() => {
    if (placed.size !== TOTAL_PIECES || phase !== "play") return;
    // 800ms beat, then the screen inverts
    const id = window.setTimeout(() => setPhase("cleared"), 800);
    return () => window.clearTimeout(id);
  }, [placed, phase]);

  useEffect(() => {
    if (phase !== "cleared") return;
    const id = window.setTimeout(async () => {
      await resetPieces();
      writeSessionStamp();
      setPlaced(new Set());
      setPieces((prev) =>
        prev
          ? prev.map((row) => ({ ...row, earned: false, earned_at: null }))
          : prev,
      );
      setPhase("play");
    }, 5000);
    return () => window.clearTimeout(id);
  }, [phase]);

  const placedLabel = label(placed.size);

  return (
    <SpaceBg className="h-[100dvh] overflow-hidden">
      {/* thin black strip, hairline bottom border */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 bg-space px-4 py-2 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.35em] text-ink sm:text-xs sm:tracking-[0.4em]">
          ORBIT // STAGE 01
        </p>
        <p className="flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
          PIECES
          <span className="text-xl leading-none text-ink sm:text-2xl">
            {placedLabel}
            <span className="text-white/25">/{label(TOTAL_PIECES)}</span>
          </span>
        </p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:flex-row md:gap-6 md:p-6">
        {/* ---------------- board ---------------- */}
        <section className="flex min-h-0 flex-[3] items-center justify-center">
          <div
            ref={wrapRef}
            className="flex h-full min-h-0 w-full items-center justify-center"
          >
            {boardSize > 0 ? (
              <div
                className="relative border border-white/15 bg-space"
                style={{ width: boardSize, height: boardSize }}
              >
                {/* placement guide: the whole artwork at 8%, grayscale */}
                <img
                  src={siteUrl(PUZZLE_IMAGE)}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.08]"
                  style={{ filter: "grayscale(1) contrast(1.1)" }}
                />

                {Array.from({ length: TOTAL_PIECES }, (_, index) => {
                  const { row, col } = pieceRowCol(index);
                  if (placed.has(index)) return null;
                  return (
                    <div
                      key={`slot-${index}`}
                      ref={(el) => {
                        slotRefs.current[index] = el;
                      }}
                      className="absolute border border-dashed border-white/10"
                      style={{
                        left: col * cell,
                        top: row * cell,
                        width: cell,
                        height: cell,
                      }}
                    />
                  );
                })}

                {[...placed].map((index) => {
                  const { row, col } = pieceRowCol(index);
                  return (
                    <motion.div
                      key={`placed-${index}`}
                      initial={{ opacity: 0.4, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className="pointer-events-none absolute text-white/40"
                      style={{
                        left: col * cell - pieceBoxOffset(cell),
                        top: row * cell - pieceBoxOffset(cell),
                      }}
                    >
                      <PieceArt
                        index={index}
                        cell={cell}
                        uid={`board-${index}`}
                      />
                    </motion.div>
                  );
                })}

                {/* correct drop: solid white border flash, one beat */}
                {slotFlash ? (
                  <motion.span
                    key={`flash-${slotFlash.n}`}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="pointer-events-none absolute border border-white"
                    style={{
                      left: pieceRowCol(slotFlash.slot).col * cell,
                      top: pieceRowCol(slotFlash.slot).row * cell,
                      width: cell,
                      height: cell,
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {/* ---------------- tray ---------------- */}
        <section className="flex min-h-0 flex-[2] flex-col">
          <div className="flex min-h-0 flex-1 flex-col border border-white/15 bg-space">
            <header className="flex shrink-0 items-center justify-between border-b border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.3em]">
              <span className="text-white/45">PIECE TRAY</span>
              <span className="text-white/25">{trayPieces.length} HELD</span>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {trayPieces.length === 0 ? (
                <p className="flex h-full items-center justify-center text-center font-mono text-[10px] uppercase tracking-[0.35em] text-white/25">
                  AWAITING SCANS
                </p>
              ) : (
                <div className="grid grid-cols-2 place-items-center gap-1">
                  <AnimatePresence initial={false}>
                    {trayPieces.map((index) => (
                      <motion.div
                        key={`tray-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onPointerDown={(event) => startDrag(event, index)}
                        className={`no-select cursor-grab touch-none active:cursor-grabbing ${
                          trayFlash === index ? "text-danger" : "text-white/40"
                        }`}
                      >
                        {drag?.index === index ? (
                          // while a piece is in flight its tray cell is an empty slot
                          <div
                            className="border border-dashed border-white/10"
                            style={{
                              width: pieceBoxPx(TRAY_CELL),
                              height: pieceBoxPx(TRAY_CELL),
                            }}
                          />
                        ) : (
                          <PieceArt
                            index={index}
                            cell={TRAY_CELL}
                            uid={`tray-${index}`}
                          />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* dragged piece follows the pointer: scales up, outline goes solid white */}
      {drag ? (
        <div
          className="pointer-events-none fixed z-50 text-white"
          style={{
            left: drag.x - drag.offX * DRAG_SCALE,
            top: drag.y - drag.offY * DRAG_SCALE,
          }}
        >
          <PieceArt
            index={drag.index}
            cell={TRAY_CELL * DRAG_SCALE}
            uid="ghost"
          />
        </div>
      ) : null}

      {/* ---------------- win sequence: the screen inverts ---------------- */}
      {phase === "cleared" ? (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink px-6">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.2 }}
            className="text-center text-[clamp(2.4rem,9vw,7rem)] font-bold uppercase leading-none tracking-[0.14em] text-space"
          >
            STAGE CLEARED
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.2 }}
            className="mt-6 font-mono text-[10px] uppercase tracking-[0.45em] text-space/60"
          >
            PROCEED TO NEXT STAGE
          </motion.p>
        </div>
      ) : null}
    </SpaceBg>
  );
}
