"use client";

import { useCallback, useEffect, useState } from "react";
import Panel from "@/components/Panel";
import SpaceBg from "@/components/SpaceBg";
import {
  isValidQrId,
  label,
  markQrUsed,
  minigameFor,
  type MinigameType,
} from "@/lib/config";
import { earnPiece, fetchPieces } from "@/lib/supabase";
import MazeGame from "@/minigames/MazeGame";
import MemoryFlip from "@/minigames/MemoryFlip";
import SequenceTap from "@/minigames/SequenceTap";
import SlidingPuzzle from "@/minigames/SlidingPuzzle";

type View =
  | "loading"
  | "invalid"
  | "locked"
  | "minigame"
  | "claiming"
  | "success";

const GAME_LABEL: Record<MinigameType, string> = {
  sliding: "SLIDING PUZZLE",
  memory: "MEMORY FLIP",
  sequence: "SEQUENCE TAP",
  maze: "MAZE",
};

function Blink({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="h-3 w-3 bg-ink animate-blink" />
      <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/45">
        {text}
      </p>
    </div>
  );
}

/** The phone page for one printed code: claim, minigame, locked or success. */
export default function QrClaim({ id }: { id: string }) {
  const qrId = Number(id);
  const game = minigameFor(qrId);
  const [view, setView] = useState<View>("loading");

  const claim = useCallback(async () => {
    setView("claiming");
    await earnPiece(qrId);
    markQrUsed(qrId);
    setView("success");
  }, [qrId]);

  useEffect(() => {
    if (!isValidQrId(qrId)) {
      setView("invalid");
      return;
    }

    let cancelled = false;
    setView("loading");

    (async () => {
      const rows = await fetchPieces();
      if (cancelled) return;
      const row = rows.find((piece) => piece.id === qrId);

      // A claimed piece is claimed for everyone — show the locked screen.
      if (row?.earned) {
        setView("locked");
        return;
      }
      if (game) {
        setView("minigame");
        return;
      }
      await claim();
    })();

    return () => {
      cancelled = true;
    };
  }, [qrId, game, claim]);

  return (
    <SpaceBg className="items-center justify-center p-4">
      <div className="w-full max-w-[min(94vw,94vh,520px)]">
        <Panel
          label={`QR ${label(qrId)} // PROTOCOL`}
          bodyClassName={
            view === "minigame" ? "p-4" : "aspect-square p-6 flex items-center"
          }
        >
          {view === "loading" ? <Blink text="LINKING" /> : null}

          {view === "claiming" ? <Blink text="TRANSMITTING PIECE" /> : null}

          {view === "invalid" ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="flex h-20 w-20 items-center justify-center border border-danger text-4xl text-danger">
                ✕
              </span>
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-danger">
                STATUS: UNKNOWN CODE
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/25">
                USE ONE OF THE 9 PRINTED CODES
              </p>
            </div>
          ) : null}

          {view === "locked" ? (
            <div className="flex flex-col items-center gap-5 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-danger">
                STATUS: CLAIMED
              </p>
              <span className="flex h-24 w-24 items-center justify-center border border-white/25 text-5xl text-ink">
                ✕
              </span>
              <p className="font-mono text-sm uppercase tracking-[0.3em] text-ink">
                PIECE ALREADY ACTIVE
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/25">
                PLEASE CLOSE THIS TAB
              </p>
            </div>
          ) : null}

          {view === "success" ? (
            // verified: small status line, inverted check badge, then the
            // action — black on white, three lines, nothing else
            <div className="flex flex-col items-center gap-6 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-ink">
                STATUS: VERIFIED
              </p>
              <span className="flex h-24 w-24 items-center justify-center bg-ink text-5xl leading-none text-space">
                ✓
              </span>
              <p className="font-mono text-[clamp(0.95rem,4.5vw,1.25rem)] uppercase leading-tight tracking-[0.2em] text-ink">
                QR {label(qrId)} // PIECE TRANSMITTED
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/25">
                PLEASE CLOSE THIS TAB
              </p>
            </div>
          ) : null}

          {view === "minigame" && game ? (
            <div className="w-full">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
                {GAME_LABEL[game]} // SOLVE TO UNLOCK PIECE {label(qrId)}
              </p>
              {game === "sliding" ? <SlidingPuzzle onWin={claim} /> : null}
              {game === "memory" ? <MemoryFlip onWin={claim} /> : null}
              {game === "sequence" ? <SequenceTap onWin={claim} /> : null}
              {game === "maze" ? <MazeGame onWin={claim} qrId={qrId} /> : null}
            </div>
          ) : null}
        </Panel>
      </div>
    </SpaceBg>
  );
}
